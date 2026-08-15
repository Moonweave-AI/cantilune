import type {
  ActivationDomainId,
  BindingGeneration,
  CollaborationSnapshot,
  EpochId,
  EpochOrdinal,
  Result,
  SchemaAdmissionId,
  SchemaEpochBinding,
  SchemaRef,
  SnapshotRef,
} from "@cantilune/core";
import type { RuntimeViolation } from "../foundation/errors.js";

export interface RuntimeActivationState {
  readonly domainId: ActivationDomainId;
  readonly binding: SchemaEpochBinding;
  readonly head: SnapshotRef;
  readonly snapshot: CollaborationSnapshot;
  readonly resourcesClear: boolean;
  readonly sessionsQuiescent: boolean;
  readonly activeAdmissions: number;
}

export interface EpochTransitionRequest {
  readonly admissionId: SchemaAdmissionId;
  readonly domainId: ActivationDomainId;
  readonly expectedBindingGeneration: BindingGeneration;
  readonly expectedHead: SnapshotRef;
  readonly expectedEpochId: EpochId;
  readonly expectedEpochOrdinal: EpochOrdinal;
  readonly targetSchemaRef: SchemaRef;
  readonly targetEpochId: EpochId;
  readonly targetEpochOrdinal: EpochOrdinal;
  readonly planDigest: string;
}

/** Opaque prepared token — only runtime epoch admin may construct. */
export interface PreparedEpochTransition {
  readonly preparedId: string;
  readonly planDigest: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface RuntimeEpochReceipt {
  readonly admissionId: SchemaAdmissionId;
  readonly beforeSnapshotRef: SnapshotRef;
  readonly afterSnapshotRef: SnapshotRef;
  readonly fromBinding: SchemaEpochBinding;
  readonly toBinding: SchemaEpochBinding;
}

export interface RuntimeEpochAdministration {
  inspectActivationPoint(
    domainId: ActivationDomainId,
  ): Promise<Result<RuntimeActivationState, RuntimeViolation>>;
  prepareEpochTransition(
    request: EpochTransitionRequest,
  ): Promise<Result<PreparedEpochTransition, RuntimeViolation>>;
  commitEpochTransition(
    prepared: PreparedEpochTransition,
  ): Promise<Result<RuntimeEpochReceipt, RuntimeViolation>>;
  recoverEpochTransition(
    admissionId: SchemaAdmissionId,
  ): Promise<Result<RuntimeEpochReceipt, RuntimeViolation>>;
}
