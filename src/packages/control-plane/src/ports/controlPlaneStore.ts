import type {
  ActivationDomainId,
  BindingGeneration,
  ControlPlaneEventId,
  IdempotencyKey,
  PreparedAdmissionId,
  SchemaAdmissionId,
  SchemaAdmissionReceipt,
  SchemaEpochBinding,
  SchemaRef,
  StoreSequence,
} from "@cantilune/core";
import type { SchemaAdmissionState } from "../admission/schemaAdmissionState.js";
import type { SchemaRevision } from "../schema/schemaRevision.js";
import type { PolicyRevision } from "../policy/policyRevision.js";
import type { SchemaAdmissionRecord } from "../admission/schemaAdmissionRequest.js";
import type {
  CommitDecisionRecord,
  PreparedAdmissionRecord,
} from "../admission/preparedAdmissionRecord.js";
import type { QualificationEvidence } from "../administration/qualificationEvaluator.js";
import type { AuthorizationEvidence } from "../administration/administrationAuthorizer.js";
import type { VerifiedFourViewEvidence } from "@cantilune/conformance";

export type ControlPlaneEventKind =
  | "SchemaRevisionRegistered"
  | "SchemaAdmissionSubmitted"
  | "SchemaAdmissionQualified"
  | "SchemaAdmissionAuthorized"
  | "SchemaAdmissionCommitted"
  | "SchemaAdmissionRejected"
  | "PolicyRevisionRegistered"
  | "PolicyActivationCommitted"
  | "SchemaAdmissionPrepared"
  | "RuntimeBindingDesired"
  | "ControlPlaneFrozen";

export interface ControlPlaneEventEnvelope {
  readonly eventId: ControlPlaneEventId;
  readonly storeSequence: StoreSequence;
  readonly kind: ControlPlaneEventKind;
  readonly occurredAt: string;
  readonly actor: string;
  readonly idempotencyKey?: IdempotencyKey;
  readonly payload: unknown;
}

export interface ControlPlaneSnapshot {
  readonly revisions: ReadonlyMap<string, SchemaRevision>;
  readonly policies: ReadonlyMap<string, PolicyRevision>;
  readonly activeBindings: ReadonlyMap<ActivationDomainId, SchemaEpochBinding>;
  readonly admissions: ReadonlyMap<SchemaAdmissionId, SchemaAdmissionRecord>;
  readonly preparedAdmissions: ReadonlyMap<PreparedAdmissionId, PreparedAdmissionRecord>;
  readonly commitDecisions: ReadonlyMap<SchemaAdmissionId, CommitDecisionRecord>;
  readonly commitReceipts: ReadonlyMap<SchemaAdmissionId, SchemaAdmissionReceipt>;
  readonly idempotency: ReadonlyMap<
    IdempotencyKey,
    { readonly digest: string; readonly resultRef: string }
  >;
  readonly events: readonly ControlPlaneEventEnvelope[];
  readonly frozen: boolean;
  readonly lastSequence: StoreSequence;
}

export interface IdempotencyClaim {
  readonly key: IdempotencyKey;
  readonly digest: string;
}

export interface ActiveBindingCas {
  readonly domainId: ActivationDomainId;
  readonly expectedGeneration: BindingGeneration;
  readonly nextBinding: SchemaEpochBinding;
}

export interface FinalizeAdmissionCommitInput {
  readonly domainId: ActivationDomainId;
  readonly expectedGeneration: BindingGeneration;
  readonly nextBinding: SchemaEpochBinding;
  readonly admission: SchemaAdmissionRecord;
  readonly commitDecision: CommitDecisionRecord;
  readonly event: ControlPlaneEventEnvelope;
  readonly receipt: SchemaAdmissionReceipt;
}

export type FinalizeAdmissionCommitResult = "finalized" | "cas_conflict";

export interface ControlPlaneStore {
  getRevision(ref: SchemaRef): SchemaRevision | undefined;
  listRevisions(schemaId?: string): readonly SchemaRevision[];
  registerRevision(revision: SchemaRevision): void;
  registerPolicy(revision: PolicyRevision): void;
  getPolicy(ref: PolicyRevision["policyRef"]): PolicyRevision | undefined;
  getActiveBinding(domainId: ActivationDomainId): SchemaEpochBinding | undefined;
  casActiveBinding(cas: ActiveBindingCas): boolean;
  getAdmission(id: SchemaAdmissionId): SchemaAdmissionRecord | undefined;
  putAdmission(record: SchemaAdmissionRecord): void;
  getPrepared(preparedId: PreparedAdmissionId): PreparedAdmissionRecord | undefined;
  putPrepared(record: PreparedAdmissionRecord): void;
  consumePrepared(preparedId: PreparedAdmissionId): PreparedAdmissionRecord | undefined;
  getCommitDecision(admissionId: SchemaAdmissionId): CommitDecisionRecord | undefined;
  putCommitDecision(record: CommitDecisionRecord): void;
  getCommitReceipt(admissionId: SchemaAdmissionId): SchemaAdmissionReceipt | undefined;
  putCommitReceipt(receipt: SchemaAdmissionReceipt): void;
  finalizeAdmissionCommit(input: FinalizeAdmissionCommitInput): FinalizeAdmissionCommitResult;
  appendEvent(envelope: ControlPlaneEventEnvelope): void;
  readEvents(sinceSequence?: StoreSequence): readonly ControlPlaneEventEnvelope[];
  claimIdempotency(claim: IdempotencyClaim): "claimed" | "replay" | "conflict";
  releaseIdempotency(key: IdempotencyKey): void;
  setFrozen(frozen: boolean): void;
  isFrozen(): boolean;
  snapshot(): ControlPlaneSnapshot;
  nextEvent(
    kind: ControlPlaneEventKind,
    actor: string,
    payload: unknown,
    idempotencyKey?: IdempotencyKey,
  ): ControlPlaneEventEnvelope;
}

export interface SchemaAdmissionEvidenceBundle {
  readonly qualification?: QualificationEvidence;
  readonly authorization?: AuthorizationEvidence;
  readonly fourView?: VerifiedFourViewEvidence;
}

export function admissionDigest(record: SchemaAdmissionRecord): string {
  return JSON.stringify({
    admissionId: record.request.admissionId,
    activationDomainId: record.request.activationDomainId,
    candidateSchemaRef: record.request.candidateSchemaRef,
    expectedBindingGeneration: record.request.expectedBindingGeneration,
    expectedSchemaRef: record.request.expectedSchemaRef,
    expectedEpochId: record.request.expectedEpochId,
    expectedEpochOrdinal: record.request.expectedEpochOrdinal,
    expectedRuntimeHead: record.request.expectedRuntimeHead,
    requestedBy: record.request.requestedBy,
    state: record.state as SchemaAdmissionState,
  });
}
