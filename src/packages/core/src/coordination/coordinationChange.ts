import type { ChangeId, EpochId, OperationTypeId, SessionId } from "../primitives/ids.js";
import type {
  ContentRef,
  EvidenceRef,
  MatchBinding,
  OperationTemplateRef,
  SnapshotRef,
  TargetRef,
} from "../primitives/refs.js";
import {
  matchBindingsFromTargets as deriveBindingsFromTargets,
  targetsFromMatchBindings as deriveTargetsFromBindings,
} from "../primitives/refs.js";
import type { Timestamp } from "../primitives/time.js";
import type { ActorRef } from "../nodes/participant.js";

/** Whether a committed change appears on external observable traces. */
export type ChangeVisibility = "internal" | "external" | "administrative";

/**
 * Small, inline operation data that is neither an entity binding nor content.
 *
 * Rich bodies remain content-addressed through `inputContentRefs`. These
 * scalars are reserved for replay-relevant control values such as a heartbeat
 * turn counter. `null`, arrays, and objects are deliberately excluded so the
 * runtime wire contract stays unambiguous.
 */
export type OperationScalarValue = string | number | boolean;
export type OperationScalarInputs = Readonly<Record<string, OperationScalarValue>>;

/**
 * Actor- or runtime-submitted intent before admission.
 * Not persisted in ChangeLog until commit succeeds.
 */
export interface CoordinationIntent {
  readonly initiator: ActorRef;
  readonly operationTypeId: OperationTypeId;
  readonly matchBindings: readonly MatchBinding[];
  readonly targets: readonly TargetRef[];
  /** Ordered content-addressed inputs consumed by the operation handler. */
  readonly inputContentRefs?: readonly ContentRef[];
  /** Named replay-relevant scalar inputs consumed by the operation handler. */
  readonly scalarInputs?: OperationScalarInputs;
  /** External evidence for policy/audit; never interpreted as operation content. */
  readonly external?: readonly EvidenceRef[];
}

/**
 * Admitted change awaiting atomic commit (transient between admit and commit).
 * Only runtime admission should construct this after policy/world checks.
 */
export interface ProposedChange {
  readonly intent: CoordinationIntent;
  readonly beforeRef: SnapshotRef;
}

/**
 * A committed, auditable coordination step (DPOEvent σ).
 * Deliberately carries no payload — body content lives on WorkArtifact.contentRef.
 */
export interface CoordinationChange {
  readonly changeId: ChangeId;
  readonly recordedAt: Timestamp;
  readonly epochId: EpochId;
  readonly operationTypeId: OperationTypeId;
  readonly templateRef?: OperationTemplateRef;
  readonly beforeRef: SnapshotRef;
  readonly afterRef: SnapshotRef;
  readonly matchBindings: readonly MatchBinding[];
  readonly targets: readonly TargetRef[];
  readonly initiator: ActorRef;
  readonly involved: readonly ActorRef[];
  readonly authorization: readonly EvidenceRef[];
  readonly external: readonly EvidenceRef[];
  readonly createdSessionRefs: readonly SessionId[];
  readonly visibility: ChangeVisibility;
}

export function coordinationIntent(
  initiator: ActorRef,
  operationTypeId: OperationTypeId,
  matchBindings: readonly MatchBinding[],
  external?: readonly EvidenceRef[],
  inputContentRefs?: readonly ContentRef[],
  scalarInputs?: OperationScalarInputs,
): CoordinationIntent {
  const targets = deriveTargetsFromBindings(matchBindings);
  return {
    initiator,
    operationTypeId,
    matchBindings,
    targets,
    ...(inputContentRefs !== undefined ? { inputContentRefs } : {}),
    ...(scalarInputs !== undefined ? { scalarInputs } : {}),
    ...(external !== undefined ? { external } : {}),
  };
}

/** Backward-compatible intent constructor from legacy flat targets. */
export function coordinationIntentFromTargets(
  initiator: ActorRef,
  operationTypeId: OperationTypeId,
  targets: readonly TargetRef[],
  external?: readonly EvidenceRef[],
  inputContentRefs?: readonly ContentRef[],
  scalarInputs?: OperationScalarInputs,
): CoordinationIntent {
  return coordinationIntent(
    initiator,
    operationTypeId,
    deriveBindingsFromTargets(targets),
    external,
    inputContentRefs,
    scalarInputs,
  );
}

export function proposedChange(intent: CoordinationIntent, beforeRef: SnapshotRef): ProposedChange {
  return { intent, beforeRef };
}

export interface CoordinationChangeInit {
  readonly changeId: ChangeId;
  readonly recordedAt: Timestamp;
  readonly epochId: EpochId;
  readonly operationTypeId: OperationTypeId;
  readonly templateRef?: OperationTemplateRef;
  readonly beforeRef: SnapshotRef;
  readonly afterRef: SnapshotRef;
  readonly matchBindings?: readonly MatchBinding[];
  readonly targets?: readonly TargetRef[];
  readonly initiator: ActorRef;
  readonly involved?: readonly ActorRef[];
  readonly authorization?: readonly EvidenceRef[];
  readonly external?: readonly EvidenceRef[];
  readonly createdSessionRefs?: readonly SessionId[];
  readonly visibility: ChangeVisibility;
}

export function coordinationChange(init: CoordinationChangeInit): CoordinationChange {
  const targets =
    init.targets ??
    (init.matchBindings !== undefined ? deriveTargetsFromBindings(init.matchBindings) : []);
  const matchBindings = init.matchBindings ?? deriveBindingsFromTargets(targets);
  return {
    changeId: init.changeId,
    recordedAt: init.recordedAt,
    epochId: init.epochId,
    operationTypeId: init.operationTypeId,
    ...(init.templateRef !== undefined ? { templateRef: init.templateRef } : {}),
    beforeRef: init.beforeRef,
    afterRef: init.afterRef,
    matchBindings,
    targets,
    initiator: init.initiator,
    involved: init.involved ?? [],
    authorization: init.authorization ?? [],
    external: init.external ?? [],
    createdSessionRefs: init.createdSessionRefs ?? [],
    visibility: init.visibility,
  };
}

/** Convenience alias for matched entities in a change. */
export type ChangeTargets = readonly TargetRef[];
