import type { EpochId } from "../primitives/ids.js";
import type { SnapshotRef } from "../primitives/refs.js";
import type {
  ActivationDomainId,
  AdmissionTombstoneId,
  BindingGeneration,
  CorrelationId,
  EpochOrdinal,
  HandlerManifestRef,
  IdempotencyKey,
  OccurrenceId,
  PlanDigest,
  PolicyRef,
  SchemaAdmissionId,
  SchemaRef,
  StoreSequence,
} from "../primitives/controlPlaneIds.js";

/** Active schema/epoch binding after admission — not a revision lifecycle state. */
export interface SchemaEpochBinding {
  readonly activationDomainId: ActivationDomainId;
  readonly bindingGeneration: BindingGeneration;
  readonly epochId: EpochId;
  readonly epochOrdinal: EpochOrdinal;
  readonly schemaRef: SchemaRef;
  readonly policyRef: PolicyRef;
  readonly handlerManifestRef: HandlerManifestRef;
  readonly runtimeHead: SnapshotRef;
  readonly admissionId: SchemaAdmissionId;
  readonly previousBindingGeneration?: BindingGeneration;
  readonly activatedBy: string;
  readonly activatedAt: string;
}

/** Durable receipt for a committed schema admission boundary. */
export interface SchemaAdmissionReceipt {
  readonly admissionId: SchemaAdmissionId;
  readonly activationDomainId: ActivationDomainId;
  readonly fromBinding: SchemaEpochBinding;
  readonly toBinding: SchemaEpochBinding;
  readonly beforeSnapshotRef: SnapshotRef;
  readonly afterSnapshotRef: SnapshotRef;
  readonly extensionPlanRef: string;
  readonly fourViewEvidenceRef?: string;
  readonly nativeOccurrenceEvidenceRef?: string;
  readonly replayEvidenceRef?: string;
  readonly qualificationEvidenceRef?: string;
  readonly authorizationEvidenceRef?: string;
  readonly runtimeReadinessEvidenceRef?: string;
  readonly admissionTombstoneId: AdmissionTombstoneId;
  readonly committedBy: string;
  readonly committedAt: string;
  readonly storeSequence: StoreSequence;
  readonly correlationId: CorrelationId;
  readonly occurrenceId: OccurrenceId;
  readonly idempotencyKey: IdempotencyKey;
  readonly planDigest: PlanDigest;
}
