import type { RuntimeInstanceId, SchemaEpochBinding } from "@cantilune/core";

export type RuntimeBindingStatus = "pending" | "acknowledged" | "degraded" | "failed" | "drift";

export interface RuntimeBinding {
  readonly runtimeInstanceId: RuntimeInstanceId;
  readonly desiredBinding: SchemaEpochBinding;
  readonly observedBinding?: SchemaEpochBinding;
  readonly status: RuntimeBindingStatus;
  readonly lastAcknowledgedAt?: string;
  readonly runtimeReceiptRef?: string;
  readonly drift?: boolean;
  readonly lastError?: string;
}

export interface RolloutPlan {
  readonly domainId: SchemaEpochBinding["activationDomainId"];
  readonly targetBinding: SchemaEpochBinding;
  readonly runtimeInstanceIds: readonly RuntimeInstanceId[];
}

export function reconcileRuntimeBinding(binding: RuntimeBinding): RuntimeBinding {
  if (binding.observedBinding === undefined) {
    return { ...binding, status: "pending", drift: true };
  }
  const drift =
    binding.observedBinding.bindingGeneration !== binding.desiredBinding.bindingGeneration ||
    binding.observedBinding.schemaRef.digest !== binding.desiredBinding.schemaRef.digest;
  if (drift) {
    return { ...binding, status: "drift", drift: true };
  }
  return { ...binding, status: "acknowledged", drift: false };
}
