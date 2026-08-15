/**
 * Control-plane service wiring for the CLI (ADR-0006).
 *
 * Boots an in-process ControlPlaneService from a MemoryControlPlaneStore via
 * `bootstrapDefaultControlPlane`, which seeds a genesis schema revision and
 * an active binding. The service is read by /schema * commands and the
 * SchemaView; the CLI does not submit or approve schema admissions (that is
 * governance territory handled out-of-band), so only the read-side + the
 * monotone-extension validator are surfaced.
 *
 * The controller is a thin lazy holder: the store + service are built once and
 * the same instance is returned on every call. `computeMonotoneExtensionPlan`
 * is re-exported for the schema-diff / schema-validate views.
 */
import {
  bootstrapDefaultControlPlane,
  computeMonotoneExtensionPlan,
  type ControlPlaneService,
  type SchemaExtensionPlan,
} from "@cantilune/control-plane";
import { MemoryControlPlaneStore } from "@cantilune/control-plane/memory";
import type { OrchestrationSchema } from "@cantilune/runtime";
import type { Result, SchemaRef } from "@cantilune/core";

export interface ControlPlaneController {
  /** The bootstrapped read-only control-plane service. */
  readonly service: ControlPlaneService;
  /** The genesis schema revision bound at boot. */
  readonly genesisRevision: ReturnType<typeof bootstrapDefaultControlPlane>["genesisRevision"];
  /** The genesis active epoch binding. */
  readonly genesisBinding: ReturnType<typeof bootstrapDefaultControlPlane>["genesisBinding"];
  /**
   * Compute the monotone extension plan from `from` to `to`. Returns the plan
   * on a monotone extension, or a control-plane violation on a non-monotone
   * one (deletion / redefinition / port-contract drift).
   */
  monotoneExtension(
    fromSchema: OrchestrationSchema,
    toSchema: OrchestrationSchema,
    fromRef: SchemaRef,
    toRef: SchemaRef,
  ): Result<SchemaExtensionPlan, unknown>;
}

let cached: ControlPlaneController | undefined;

/** Build (once) and return the CLI control-plane controller. */
export function getControlPlaneController(): ControlPlaneController {
  if (cached !== undefined) return cached;
  const store = new MemoryControlPlaneStore();
  const { service, genesisRevision, genesisBinding } = bootstrapDefaultControlPlane(store);
  cached = {
    service,
    genesisRevision,
    genesisBinding,
    monotoneExtension: (fromSchema, toSchema, fromRef, toRef) =>
      computeMonotoneExtensionPlan(fromSchema, toSchema, fromRef, toRef) as Result<
        SchemaExtensionPlan,
        unknown
      >,
  };
  return cached;
}

/** Reset the cached controller (used by tests to get a fresh genesis). */
export function resetControlPlaneController(): void {
  cached = undefined;
}
