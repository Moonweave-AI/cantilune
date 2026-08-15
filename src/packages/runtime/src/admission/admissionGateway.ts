import { randomUUID } from "node:crypto";
import type {
  CoordinationIntent,
  CoreViolation,
  EpochId,
  SnapshotRef,
  ActorRef,
} from "@cantilune/core";
import { validateSnapshotIntegrityResult } from "@cantilune/core";
import type { TemplateCondition } from "../schema/operationTemplate.js";
import { evaluateRequires } from "../schema/conditionEvaluator.js";
import type { ActiveSchemaContext } from "../engine/activeSchemaContext.js";
import type { MutableSchemaContextHolder } from "../engine/memoryEpochAdministration.js";
import { resolveActiveSchemaContext } from "../engine/schemaContextProvider.js";
import { admittedId } from "../foundation/brands.js";
import type { AdmissionRegistry } from "./admissionRegistry.js";
import type { AdmissionTicket } from "./admissionTicket.js";
import { effectiveFootprintForAdmission } from "./footprintAuthority.js";
import { normalizeCoordinationIntent } from "./normalizeIntent.js";
import { validateAdmissionPrincipal } from "./principalValidation.js";
import type { CollaborationStore } from "../ports/collaborationStore.js";
import type { PolicyEvaluator } from "../ports/policyEvaluator.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import { replayRecipe, withRecipeAuthorization } from "../replay/recipe.js";

export type AdmissionRejectReason =
  | { readonly kind: "template_not_found" }
  | { readonly kind: "missing_role"; readonly role: string }
  | { readonly kind: "requires_failed"; readonly condition: TemplateCondition }
  | { readonly kind: "policy_denied"; readonly reason: string }
  | { readonly kind: "resource_conflict" }
  /**
   * Carries both epochs because the bare tag was undiagnosable: an operator
   * seeing `epoch_mismatch` could not tell which side was wrong, and one
   * incident ended with the agent inventing an epoch id in its report.
   */
  | {
      readonly kind: "epoch_mismatch";
      readonly headEpochId: EpochId;
      readonly activeEpochId: EpochId;
    }
  | { readonly kind: "snapshot_invalid"; readonly cause: CoreViolation }
  | { readonly kind: "head_not_found" }
  | { readonly kind: "principal_invalid"; readonly reason: string };

export type AdmissionResult =
  | { readonly ok: true; readonly ticket: AdmissionTicket }
  | { readonly ok: false; readonly reason: AdmissionRejectReason };

/**
 * Human- and agent-readable rendering of a rejection, including the payload.
 *
 * Callers used to surface `reason.kind` alone, which discarded every field the
 * variants carry — which role was missing, which condition failed, which policy
 * refused. The caller is usually an LLM expected to correct itself from this
 * text, so a bare tag left it guessing, and the same operation was retried
 * unchanged until the turn limit.
 */
export function describeRejectReason(reason: AdmissionRejectReason): string {
  switch (reason.kind) {
    case "missing_role":
      return `missing_role: no binding for required role "${reason.role}"`;
    case "requires_failed":
      return `requires_failed: precondition "${reason.condition.kind}" does not hold`;
    case "policy_denied":
      return `policy_denied: ${reason.reason}`;
    case "principal_invalid":
      return `principal_invalid: ${reason.reason}`;
    case "epoch_mismatch":
      return (
        `epoch_mismatch: head snapshot is at epoch ${String(reason.headEpochId)} but the active ` +
        `schema is bound to epoch ${String(reason.activeEpochId)}`
      );
    case "snapshot_invalid":
      return `snapshot_invalid: ${reason.cause.code} ${reason.cause.message}`;
    case "resource_conflict":
      return "resource_conflict: another in-flight operation holds an overlapping footprint";
    case "template_not_found":
      return "template_not_found: operation type is not in the active schema";
    case "head_not_found":
      return "head_not_found: the coordination world has no readable head snapshot";
  }
}

export interface AdmissionGatewayDeps {
  readonly store: Pick<CollaborationStore, "get" | "head">;
  readonly schemaContext: ActiveSchemaContext | MutableSchemaContextHolder;
  readonly policy: PolicyEvaluator;
  readonly locks: ResourceLockTable;
  readonly registry: AdmissionRegistry;
  readonly nextAdmittedId?: () => string;
  readonly lockLeaseMs?: number;
}

export interface AdmissionInput {
  readonly intent: CoordinationIntent;
  readonly beforeRef?: SnapshotRef;
  readonly principal: ActorRef;
}

export function createAdmissionGateway(deps: AdmissionGatewayDeps) {
  let admittedSeq = 0;
  // Scoped to this gateway instance, because the id keys a cross-process lock
  // table: two processes counting from 1 both minted "adm-1", and either one
  // releasing it dropped the other's lock on a footprint it still held.
  const gatewayTag = randomUUID().slice(0, 8);
  const nextId =
    deps.nextAdmittedId ??
    (() => {
      admittedSeq += 1;
      return `adm-${gatewayTag}-${String(admittedSeq)}`;
    });

  return {
    admit(input: AdmissionInput): AdmissionResult {
      const intent = normalizeCoordinationIntent(input.intent);
      const schemaContext = resolveActiveSchemaContext({ schemaContext: deps.schemaContext });

      const principalError = validateAdmissionPrincipal(intent, input.principal);
      if (principalError !== undefined) {
        return {
          ok: false,
          reason: { kind: "principal_invalid", reason: principalError.kind },
        };
      }

      const beforeRef = input.beforeRef ?? deps.store.head();
      if (beforeRef === undefined) {
        return { ok: false, reason: { kind: "head_not_found" } };
      }

      const beforeSnapshot = deps.store.get(beforeRef);
      if (beforeSnapshot === undefined) {
        return { ok: false, reason: { kind: "head_not_found" } };
      }

      const integrity = validateSnapshotIntegrityResult(beforeSnapshot);
      if (!integrity.ok) {
        return { ok: false, reason: { kind: "snapshot_invalid", cause: integrity.error } };
      }

      if (beforeSnapshot.epochId !== schemaContext.epochId) {
        return {
          ok: false,
          reason: {
            kind: "epoch_mismatch",
            headEpochId: beforeSnapshot.epochId,
            activeEpochId: schemaContext.epochId,
          },
        };
      }

      if (!schemaContext.allowedOperations.has(intent.operationTypeId)) {
        return { ok: false, reason: { kind: "template_not_found" } };
      }

      const template = schemaContext.getTemplate(intent.operationTypeId);
      if (template === undefined) {
        return { ok: false, reason: { kind: "template_not_found" } };
      }

      for (const role of template.requiredRoles) {
        if (!intent.matchBindings.some((binding) => binding.role === role)) {
          return { ok: false, reason: { kind: "missing_role", role } };
        }
      }

      const failedCondition = evaluateRequires(
        beforeSnapshot,
        intent.matchBindings,
        template.requires,
      );
      if (failedCondition !== undefined) {
        return { ok: false, reason: { kind: "requires_failed", condition: failedCondition } };
      }

      const effectiveFootprint = effectiveFootprintForAdmission(intent, template);

      const policyDecision = deps.policy.evaluate({
        snapshot: beforeSnapshot,
        intent,
        template,
        effectiveFootprint,
        policyRevision: schemaContext.epochId,
      });
      if (policyDecision.kind === "deny") {
        return { ok: false, reason: { kind: "policy_denied", reason: policyDecision.reason } };
      }

      const ticketId = admittedId(nextId());
      const leaseMs = deps.lockLeaseMs ?? 60_000;
      if (!deps.locks.acquire(ticketId, effectiveFootprint, leaseMs)) {
        return { ok: false, reason: { kind: "resource_conflict" } };
      }

      const recipe = withRecipeAuthorization(
        replayRecipe({
          epochId: beforeSnapshot.epochId,
          operationTypeId: intent.operationTypeId,
          templateRef: template.templateRef,
          matchBindings: intent.matchBindings,
          external: intent.external ?? [],
          visibility: template.defaultVisibility,
          inputContentRefs: intent.inputContentRefs ?? [],
          scalarInputs: intent.scalarInputs ?? {},
        }),
        policyDecision.authorization,
      );

      const ticket = deps.registry.register(
        {
          admittedId: ticketId,
          principal: input.principal,
          intent,
          beforeSnapshot,
          beforeRef,
          template,
          effectiveFootprint,
          recipe,
          authorization: policyDecision.authorization,
          policyRevision: schemaContext.epochId,
        },
        leaseMs,
      );

      return { ok: true, ticket };
    },

    cancel(ticket: AdmissionTicket): void {
      deps.registry.cancel(ticket);
    },
  };
}

export type AdmissionGateway = ReturnType<typeof createAdmissionGateway>;
