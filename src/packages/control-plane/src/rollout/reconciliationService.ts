import type { RuntimeInstanceId } from "@cantilune/core";
import type { FileControlPlaneStore } from "../file/fileControlPlaneStore.js";
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

export interface ReconciliationServiceOptions {
  readonly fileStore?: FileControlPlaneStore;
}

export class ReconciliationService {
  // NOSONAR — bindings is already readonly
  private readonly bindings = new Map<RuntimeInstanceId, RuntimeBinding>();
  private readonly fileStore: FileControlPlaneStore | undefined;

  constructor(options: ReconciliationServiceOptions = {}) {
    this.fileStore = options.fileStore;
    if (this.fileStore !== undefined) {
      for (const [id, binding] of this.fileStore.loadFleetBindings()) {
        this.bindings.set(id, binding);
      }
    }
  }

  setDesired(plan: RolloutPlan): void {
    for (const runtimeInstanceId of plan.runtimeInstanceIds) {
      this.bindings.set(runtimeInstanceId, {
        runtimeInstanceId,
        desiredBinding: plan.targetBinding,
        status: "pending",
        drift: true,
      });
    }
    this.persist();
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
    this.persist();
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

  private persist(): void {
    if (this.fileStore === undefined) {
      return;
    }
    this.fileStore.persistFleetBindings(this.bindings);
  }
}

export function createReconciliationService(
  options: ReconciliationServiceOptions = {},
): ReconciliationService {
  return new ReconciliationService(options);
}
