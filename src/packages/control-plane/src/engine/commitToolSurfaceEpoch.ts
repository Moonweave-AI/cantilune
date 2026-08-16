import {
  admissionTombstoneId,
  correlationId,
  err,
  idempotencyKey,
  occurrenceId,
  ok,
  planDigest,
  schemaAdmissionId,
  storeSequence,
  type Result,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
} from "@cantilune/core";
import { createNextBinding } from "../activation/epochTransitionPlan.js";
import { nextEpochFrom } from "../activation/epochIdentity.js";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import type { ControlPlaneStore } from "../ports/controlPlaneStore.js";

export interface CommitToolSurfaceEpochInput {
  readonly store: ControlPlaneStore;
  readonly operator: string;
  /** Informational only; the active binding is the receipt's fromBinding. */
  readonly currentEpoch?: string;
}

/**
 * Same-schema epoch bump for MCP tool-surface attach (ADR-0026 / Owner G9).
 *
 * This is not a schema-content change and does not mint a FourView /
 * ProjectionCertificate. The operator command is the authorization.
 * Schema `/schema commit` still requires sealed admission + epochAdmin.
 */
export function commitToolSurfaceEpoch(
  input: CommitToolSurfaceEpochInput,
): Result<SchemaAdmissionReceipt, ControlPlaneViolation> {
  if (input.store.isFrozen()) {
    return err(controlPlaneViolation("control_plane_frozen", "commit", "control plane is frozen"));
  }
  const active = firstActiveBinding(input.store);
  if (active === undefined) {
    return err(controlPlaneViolation("invalid_input", "commit", "no active schema binding"));
  }
  const next = nextEpochFrom(active.epochId, active.epochOrdinal);
  const admissionId = schemaAdmissionId(`mcp-surface-${Date.now()}`);
  const activatedAt = new Date().toISOString();
  const toBinding = createNextBinding({
    domainId: active.activationDomainId,
    current: active,
    targetSchemaRef: active.schemaRef,
    targetEpochId: next.epochId,
    targetEpochOrdinal: next.epochOrdinal,
    targetPolicyRef: active.policyRef,
    targetHandlerManifestRef: active.handlerManifestRef,
    runtimeHead: active.runtimeHead,
    admissionId,
    activatedBy: input.operator,
    activatedAt,
  });
  const swapped = input.store.casActiveBinding({
    domainId: active.activationDomainId,
    expectedGeneration: active.bindingGeneration,
    nextBinding: toBinding,
  });
  if (!swapped) {
    return err(controlPlaneViolation("commit_conflict", "commit", "active binding CAS failed"));
  }
  const receipt: SchemaAdmissionReceipt = {
    admissionId,
    activationDomainId: active.activationDomainId,
    fromBinding: active,
    toBinding,
    beforeSnapshotRef: active.runtimeHead,
    afterSnapshotRef: active.runtimeHead,
    extensionPlanRef: "tool-surface/same-schema",
    admissionTombstoneId: admissionTombstoneId(`tomb-${admissionId as string}`),
    committedBy: input.operator,
    committedAt: activatedAt,
    storeSequence: storeSequence((input.store.snapshot().lastSequence as number) + 1),
    correlationId: correlationId(`corr-${admissionId as string}`),
    occurrenceId: occurrenceId(`occ-${admissionId as string}`),
    idempotencyKey: idempotencyKey(`mcp-${admissionId as string}`),
    planDigest: planDigest("tool-surface/same-schema"),
  };
  input.store.putCommitReceipt(receipt);
  input.store.appendEvent(
    input.store.nextEvent("SchemaAdmissionCommitted", input.operator, {
      admissionId,
      kind: "tool_surface",
      requestedEpoch: input.currentEpoch,
    }),
  );
  return ok(receipt);
}

function firstActiveBinding(store: ControlPlaneStore): SchemaEpochBinding | undefined {
  const bindings = [...store.snapshot().activeBindings.values()];
  return bindings[0];
}
