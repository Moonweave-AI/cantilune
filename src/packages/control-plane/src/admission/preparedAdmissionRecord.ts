import type {
  BindingGeneration,
  EpochId,
  EpochOrdinal,
  PlanDigest,
  PreparedAdmissionId,
  SchemaAdmissionId,
  SchemaEpochBinding,
  SchemaRef,
  SnapshotRef,
  ActivationDomainId,
} from "@cantilune/core";

/** Server-side prepared admission — never constructable from external plain objects. */
export interface PreparedAdmissionRecord {
  readonly preparedId: PreparedAdmissionId;
  readonly admissionId: SchemaAdmissionId;
  readonly activationDomainId: ActivationDomainId;
  readonly fromSchemaRef: SchemaRef;
  readonly toSchemaRef: SchemaRef;
  readonly fromEpochId: EpochId;
  readonly toEpochId: EpochId;
  readonly fromEpochOrdinal: EpochOrdinal;
  readonly toEpochOrdinal: EpochOrdinal;
  readonly expectedBindingGeneration: BindingGeneration;
  readonly expectedRuntimeHead: SnapshotRef;
  readonly planDigest: PlanDigest;
  readonly runtimePreparedId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumed: boolean;
}

/** Opaque handle returned to clients — only the id string, no forgeable fields. */
export interface PreparedAdmissionHandle {
  readonly preparedId: PreparedAdmissionId;
  readonly expiresAt: string;
}

export type CommitDecisionStatus =
  "decided" | "runtime_applied" | "finalized" | "recovery_required";

export interface CommitDecisionRecord {
  readonly admissionId: SchemaAdmissionId;
  readonly preparedId: PreparedAdmissionId;
  readonly expectedBindingGeneration: BindingGeneration;
  readonly status: CommitDecisionStatus;
  readonly toBinding?: SchemaEpochBinding;
  readonly operator?: string;
  readonly runtimeBeforeRef?: SnapshotRef;
  readonly runtimeAfterRef?: SnapshotRef;
  readonly updatedAt: string;
}

export function toPreparedHandle(record: PreparedAdmissionRecord): PreparedAdmissionHandle {
  return { preparedId: record.preparedId, expiresAt: record.expiresAt };
}
