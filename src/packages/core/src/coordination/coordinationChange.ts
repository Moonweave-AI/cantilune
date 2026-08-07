import type { ChangeId, EpochId, OperationTypeId, SessionId } from "../primitives/ids.js";
import type { EvidenceRef, SnapshotRef, TargetRef } from "../primitives/refs.js";
import type { Timestamp } from "../primitives/time.js";
import type { ActorRef } from "../nodes/participant.js";

/** Whether a committed change appears on external observable traces. */
export type ChangeVisibility = "internal" | "external" | "administrative";

/**
 * Actor- or runtime-submitted intent before admission.
 * Not persisted in ChangeLog until commit succeeds.
 */
export interface CoordinationIntent {
  readonly initiator: ActorRef;
  readonly operationTypeId: OperationTypeId;
  readonly targets: readonly TargetRef[];
  readonly external?: readonly EvidenceRef[];
}

/**
 * Admitted change awaiting atomic commit (transient between admit and commit).
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
  readonly beforeRef: SnapshotRef;
  readonly afterRef: SnapshotRef;
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
  targets: readonly TargetRef[],
  external?: readonly EvidenceRef[],
): CoordinationIntent {
  if (external === undefined) {
    return { initiator, operationTypeId, targets };
  }
  return { initiator, operationTypeId, targets, external };
}

export function proposedChange(
  intent: CoordinationIntent,
  beforeRef: SnapshotRef,
): ProposedChange {
  return { intent, beforeRef };
}

export interface CoordinationChangeInit {
  readonly changeId: ChangeId;
  readonly recordedAt: Timestamp;
  readonly epochId: EpochId;
  readonly operationTypeId: OperationTypeId;
  readonly beforeRef: SnapshotRef;
  readonly afterRef: SnapshotRef;
  readonly targets: readonly TargetRef[];
  readonly initiator: ActorRef;
  readonly involved?: readonly ActorRef[];
  readonly authorization?: readonly EvidenceRef[];
  readonly external?: readonly EvidenceRef[];
  readonly createdSessionRefs?: readonly SessionId[];
  readonly visibility?: ChangeVisibility;
}

export function coordinationChange(init: CoordinationChangeInit): CoordinationChange {
  return {
    changeId: init.changeId,
    recordedAt: init.recordedAt,
    epochId: init.epochId,
    operationTypeId: init.operationTypeId,
    beforeRef: init.beforeRef,
    afterRef: init.afterRef,
    targets: init.targets,
    initiator: init.initiator,
    involved: init.involved ?? [],
    authorization: init.authorization ?? [],
    external: init.external ?? [],
    createdSessionRefs: init.createdSessionRefs ?? [],
    visibility: init.visibility ?? "external",
  };
}

/** Convenience alias for matched entities in a change (same shape as TargetRef list). */
export type ChangeTargets = readonly TargetRef[];
