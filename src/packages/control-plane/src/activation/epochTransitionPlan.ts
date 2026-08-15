import type {
  ActivationDomainId,
  BindingGeneration,
  EpochId,
  EpochOrdinal,
  HandlerManifestRef,
  PolicyRef,
  SchemaAdmissionId,
  SchemaEpochBinding,
  SchemaRef,
  SnapshotRef,
} from "@cantilune/core";

export interface ActivationBarrierState {
  readonly domainId: ActivationDomainId;
  readonly active: boolean;
  readonly reason?: string;
}

export interface EpochTransitionPlan {
  readonly admissionId: SchemaAdmissionId;
  readonly domainId: ActivationDomainId;
  readonly fromBinding: SchemaEpochBinding;
  readonly toBinding: SchemaEpochBinding;
  readonly beforeSnapshotRef: SnapshotRef;
  readonly afterSnapshotRef: SnapshotRef;
  readonly expectedHead: SnapshotRef;
}

export function createNextBinding(input: {
  readonly domainId: ActivationDomainId;
  readonly current: SchemaEpochBinding;
  readonly targetSchemaRef: SchemaRef;
  readonly targetEpochId: EpochId;
  readonly targetEpochOrdinal: EpochOrdinal;
  readonly targetPolicyRef: PolicyRef;
  readonly targetHandlerManifestRef: HandlerManifestRef;
  readonly runtimeHead: SnapshotRef;
  readonly admissionId: SchemaAdmissionId;
  readonly activatedBy: string;
  readonly activatedAt: string;
}): SchemaEpochBinding {
  if (input.targetEpochOrdinal <= input.current.epochOrdinal) {
    throw new Error("epoch_not_advanced");
  }
  return {
    activationDomainId: input.domainId,
    bindingGeneration: (input.current.bindingGeneration + 1) as BindingGeneration,
    epochId: input.targetEpochId,
    epochOrdinal: input.targetEpochOrdinal,
    schemaRef: input.targetSchemaRef,
    policyRef: input.targetPolicyRef,
    handlerManifestRef: input.targetHandlerManifestRef,
    runtimeHead: input.runtimeHead,
    admissionId: input.admissionId,
    previousBindingGeneration: input.current.bindingGeneration,
    activatedBy: input.activatedBy,
    activatedAt: input.activatedAt,
  };
}

/** Policy-only binding bump — epoch/schema unchanged. */
export function createPolicyBindingUpdate(input: {
  readonly current: SchemaEpochBinding;
  readonly targetPolicyRef: PolicyRef;
  readonly admissionId: SchemaAdmissionId;
  readonly activatedBy: string;
  readonly activatedAt: string;
}): SchemaEpochBinding {
  return {
    ...input.current,
    bindingGeneration: (input.current.bindingGeneration + 1) as BindingGeneration,
    policyRef: input.targetPolicyRef,
    previousBindingGeneration: input.current.bindingGeneration,
    admissionId: input.admissionId,
    activatedBy: input.activatedBy,
    activatedAt: input.activatedAt,
  };
}
