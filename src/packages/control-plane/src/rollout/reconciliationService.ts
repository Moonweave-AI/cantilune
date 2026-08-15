import type { RuntimeInstanceId } from "@cantilune/core";
import {
  reconcileRuntimeBinding,
  type RuntimeBinding,
  type RolloutPlan,
} from "./runtimeBinding.js";

export interface ReconciliationReport {
  readonly acknowledged: number;
  readonly pending: number;
  readonly drift: number;
  readonly failed: number;
}

export class ReconciliationService {
  // NOSONAR — bindings is already readonly
  private readonly bindings = new Map<RuntimeInstanceId, RuntimeBinding>();

  setDesired(plan: RolloutPlan): void {
    for (const runtimeInstanceId of plan.runtimeInstanceIds) {
      this.bindings.set(runtimeInstanceId, {
        runtimeInstanceId,
        desiredBinding: plan.targetBinding,
        status: "pending",
        drift: true,
      });
    }
  }

  acknowledge(
    runtimeInstanceId: RuntimeInstanceId,
    observed: RuntimeBinding["observedBinding"],
  ): void {
    const current = this.bindings.get(runtimeInstanceId);
    if (current === undefined) {
      return;
    }
    this.bindings.set(runtimeInstanceId, {
      ...current,
      ...(observed !== undefined ? { observedBinding: observed } : {}),
      lastAcknowledgedAt: new Date().toISOString(),
      status: "acknowledged",
    });
  }

  list(): readonly RuntimeBinding[] {
    return [...this.bindings.values()].map(reconcileRuntimeBinding);
  }

  report(): ReconciliationReport {
    const bindings = this.list();
    return {
      acknowledged: bindings.filter((item) => item.status === "acknowledged").length,
      pending: bindings.filter((item) => item.status === "pending").length,
      drift: bindings.filter((item) => item.status === "drift").length,
      failed: bindings.filter((item) => item.status === "failed").length,
    };
  }
}

export function createReconciliationService(): ReconciliationService {
  return new ReconciliationService();
}
