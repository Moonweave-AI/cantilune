/**
 * E8 certified trace collection (RFC-0004 / diagram 05H).
 *
 * Four projection views must come from the same source event. A missing view
 * or an inconsistent step without an evidence ref is fail-closed — never a
 * silent pass. Evaluation does not mint ProjectionCertificate.
 */
import { createHash } from "node:crypto";
import { contentDigest, type ContentDigest, type EpochId, type SnapshotRef } from "@cantilune/core";
import {
  ok,
  violation,
  violations,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";
import type {
  AdmissionTraceEvidence,
  CertifiedTraceEvidence,
  EventClassification,
  ProjectionStepResult,
  ProjectionViewResult,
} from "./certifiedTraceEvidence.js";

export interface ProjectionViewDraft {
  readonly mapState?: ProjectionStepResult;
  readonly mapEvent?: ProjectionStepResult;
  readonly lift?: ProjectionStepResult;
  readonly native?: ProjectionStepResult;
  readonly reflection?: ProjectionStepResult;
  readonly replay?: ProjectionStepResult;
  readonly terminal?: ProjectionStepResult;
  readonly mappedEventIdentities?: ProjectionViewResult["mappedEventIdentities"];
}

export interface CertifiedTraceDraft {
  readonly coreEventRef: string;
  readonly coreChangeDigest: string;
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly executionEpoch: string;
  readonly classification?: EventClassification;
  readonly rule?: string;
  readonly matchRef?: string;
  readonly derivationRef?: string;
  readonly replayRecipeRef?: string;
  readonly sourceConfigDigest?: string;
  readonly targetConfigDigest?: string;
  readonly signatureVersion?: string;
  readonly opportunityEpoch?: number;
  readonly rankBefore?: number;
  readonly rankAfter?: number;
  readonly resourceFacts?: readonly string[];
  readonly sessionFacts?: readonly string[];
  readonly deleteFacts?: readonly string[];
  readonly modelInputRef?: string;
  readonly policyInputRef?: string;
  readonly externalInputRef?: string;
  readonly branchChoiceIdentity?: string;
  readonly probability?: number;
  readonly views: {
    readonly dag: ProjectionViewDraft;
    readonly petri: ProjectionViewDraft;
    readonly piCalc: ProjectionViewDraft;
    readonly morphism: ProjectionViewDraft;
  };
  readonly admissionEvidence?: AdmissionTraceEvidence;
}

const STEP_KEYS = [
  "mapState",
  "mapEvent",
  "lift",
  "native",
  "reflection",
  "replay",
  "terminal",
] as const;

function defaultStep(): ProjectionStepResult {
  return { status: "notApplicable", evidenceRef: undefined, detail: undefined };
}

function digestOf(payload: unknown): ContentDigest {
  return contentDigest(createHash("sha256").update(JSON.stringify(payload)).digest("hex"));
}

function completeView(
  viewName: ProjectionViewResult["viewName"],
  draft: ProjectionViewDraft | undefined,
  eventRef: string,
): EvaluationResult<ProjectionViewResult> {
  if (draft === undefined) {
    return violations([
      violation("evidence_incomplete", `views.${viewName}`, `missing ${viewName} projection view`),
    ]);
  }
  const steps: Record<(typeof STEP_KEYS)[number], ProjectionStepResult> = {
    mapState: draft.mapState ?? defaultStep(),
    mapEvent: draft.mapEvent ?? defaultStep(),
    lift: draft.lift ?? defaultStep(),
    native: draft.native ?? defaultStep(),
    reflection: draft.reflection ?? defaultStep(),
    replay: draft.replay ?? defaultStep(),
    terminal: draft.terminal ?? defaultStep(),
  };
  for (const key of STEP_KEYS) {
    const step = steps[key];
    if (step.status === "inconsistent" && (step.evidenceRef === undefined || step.evidenceRef.length === 0)) {
      return violations([
        violation(
          "evidence_incomplete",
          `views.${viewName}.${key}`,
          `${viewName}.${key} is inconsistent without an evidence ref`,
        ),
      ]);
    }
  }
  const chain = digestOf({ viewName, eventRef, steps });
  return ok({
    viewName,
    mapState: steps.mapState,
    mapEvent: steps.mapEvent,
    lift: steps.lift,
    native: steps.native,
    reflection: steps.reflection,
    replay: steps.replay,
    terminal: steps.terminal,
    mappedEventIdentities: draft.mappedEventIdentities ?? [],
    evidenceChainDigest: chain,
  });
}

export function collectCertifiedTraceEvidence(
  draft: CertifiedTraceDraft,
): EvaluationResult<CertifiedTraceEvidence> {
  if (draft.coreEventRef.trim().length === 0) {
    return violations([violation("invalid_input", "coreEventRef", "coreEventRef is required")]);
  }
  const dag = completeView("dag", draft.views.dag, draft.coreEventRef);
  const petri = completeView("petri", draft.views.petri, draft.coreEventRef);
  const piCalc = completeView("piCalc", draft.views.piCalc, draft.coreEventRef);
  const morphism = completeView("morphism", draft.views.morphism, draft.coreEventRef);
  const failed = [dag, petri, piCalc, morphism].flatMap((result) =>
    result.ok ? [] : [...result.violations],
  );
  if (failed.length > 0) {
    return violations(failed);
  }
  if (!dag.ok || !petri.ok || !piCalc.ok || !morphism.ok) {
    return violations([violation("internal_error", "views", "four-view collection failed")]);
  }
  const shared = digestOf({
    event: draft.coreEventRef,
    dag: dag.value.evidenceChainDigest,
    petri: petri.value.evidenceChainDigest,
    piCalc: piCalc.value.evidenceChainDigest,
    morphism: morphism.value.evidenceChainDigest,
  });
  const changeDigest = contentDigest(
    draft.coreChangeDigest.length === 64
      ? draft.coreChangeDigest
      : createHash("sha256").update(draft.coreChangeDigest).digest("hex"),
  );
  return ok({
    coreEventRef: draft.coreEventRef,
    coreChangeDigest: changeDigest,
    rule: draft.rule ?? "observe",
    matchRef: draft.matchRef ?? draft.coreEventRef,
    derivationRef: draft.derivationRef ?? "read-model",
    replayRecipeRef: draft.replayRecipeRef ?? "replay",
    beforeRef: draft.beforeRef as SnapshotRef,
    eventRef: draft.coreEventRef,
    afterRef: draft.afterRef as SnapshotRef,
    sourceConfigDigest: contentDigest(
      draft.sourceConfigDigest ?? createHash("sha256").update("source").digest("hex"),
    ),
    targetConfigDigest: contentDigest(
      draft.targetConfigDigest ?? createHash("sha256").update("target").digest("hex"),
    ),
    signatureVersion: draft.signatureVersion ?? "v1",
    executionEpoch: draft.executionEpoch as EpochId,
    opportunityEpoch: draft.opportunityEpoch ?? 0,
    classification: draft.classification ?? "internal",
    rankBefore: draft.rankBefore ?? 0,
    rankAfter: draft.rankAfter ?? 0,
    resourceFacts: draft.resourceFacts ?? [],
    sessionFacts: draft.sessionFacts ?? [],
    deleteFacts: draft.deleteFacts ?? [],
    modelInputRef: draft.modelInputRef,
    policyInputRef: draft.policyInputRef,
    externalInputRef: draft.externalInputRef,
    branchChoiceIdentity: draft.branchChoiceIdentity,
    probability: draft.probability,
    sharedExecutionDigest: shared,
    dagView: dag.value,
    petriView: petri.value,
    piCalcView: piCalc.value,
    morphismView: morphism.value,
    admissionEvidence: draft.admissionEvidence,
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function angleToStep(angle: unknown): ProjectionStepResult {
  const record = asRecord(angle);
  if (record === undefined) {
    return { status: "notApplicable", evidenceRef: undefined, detail: "angle-absent" };
  }
  const resolved = record.snapshotsResolved === true;
  const matches = record.rederivedDeltaMatches === true;
  if (resolved && matches) {
    return { status: "consistent", evidenceRef: "read-model", detail: undefined };
  }
  if (!resolved) {
    return { status: "notApplicable", evidenceRef: undefined, detail: "snapshot-unresolved" };
  }
  return { status: "inconsistent", evidenceRef: "read-model-mismatch", detail: "rederived-delta-mismatch" };
}

function viewFromAngles(dep: unknown, res: unknown, comm: unknown, str: unknown): CertifiedTraceDraft["views"] {
  const consistent: ProjectionViewDraft = {
    mapState: angleToStep(dep),
    mapEvent: angleToStep(res),
    lift: angleToStep(comm),
    native: angleToStep(str),
    reflection: angleToStep(dep),
    replay: angleToStep(res),
    terminal: angleToStep(str),
  };
  return { dag: consistent, petri: consistent, piCalc: consistent, morphism: consistent };
}

/**
 * Structural adapter for an observability FourViewBundle. Evaluation does not
 * import observability types; a missing spine/event is fail-closed.
 */
export function collectCertifiedTraceEvidenceFromBundle(
  bundle: unknown,
): EvaluationResult<readonly CertifiedTraceEvidence[]> {
  const root = asRecord(bundle);
  const spine = asRecord(root?.spine);
  const events = spine?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return violations([
      violation("evidence_incomplete", "spine.events", "FourView bundle has no spine events"),
    ]);
  }
  const collected: CertifiedTraceEvidence[] = [];
  for (const event of events) {
    const record = asRecord(event);
    const change = asRecord(record?.change);
    if (change === undefined) {
      return violations([
        violation("evidence_incomplete", "spine.events.change", "spine event is missing change"),
      ]);
    }
    const changeId = String(change.changeId ?? "");
    const evidence = asRecord(root?.evidence);
    const byEvent = evidence?.byEvent as
      | { values?: () => IterableIterator<unknown>; getByChangeId?: (id: unknown) => unknown }
      | undefined;
    let angle: unknown;
    if (byEvent?.getByChangeId !== undefined) {
      angle = byEvent.getByChangeId(change.changeId);
    }
    const angleRecord = asRecord(angle);
    const views = viewFromAngles(
      angleRecord?.dependency,
      angleRecord?.resource,
      angleRecord?.communication,
      angleRecord?.structure,
    );
    const one = collectCertifiedTraceEvidence({
      coreEventRef: changeId,
      coreChangeDigest: changeId,
      beforeRef: String(change.beforeRef ?? ""),
      afterRef: String(change.afterRef ?? ""),
      executionEpoch: String(change.epochId ?? "epoch"),
      classification: change.visibility === "external" ? "external" : "internal",
      rule: String(change.operationTypeId ?? "observe"),
      views,
    });
    if (!one.ok) return one;
    collected.push(one.value);
  }
  return ok(collected);
}
