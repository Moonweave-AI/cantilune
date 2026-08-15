import type {
  CollaborationSnapshot,
  CoordinationIntent,
  EvidenceRef,
  Footprint,
} from "@cantilune/core";
import type { OperationTemplate } from "../schema/operationTemplate.js";

export type PolicyDecision =
  | { readonly kind: "allow"; readonly authorization: readonly EvidenceRef[] }
  | { readonly kind: "deny"; readonly reason: string };

export interface PolicyEvaluator {
  evaluate(input: {
    snapshot: CollaborationSnapshot;
    intent: CoordinationIntent;
    template: OperationTemplate;
    effectiveFootprint: Footprint;
    policyRevision?: string;
  }): PolicyDecision;
}

/** Production default — deny unless an explicit policy implementation allows. */
export function denyByDefaultPolicyEvaluator(): PolicyEvaluator {
  return {
    evaluate() {
      return { kind: "deny", reason: "no explicit policy authorization" };
    },
  };
}

/**
 * M2 production path — template requires already gate admission; policy layer records allow.
 * Pair with explicit denyByDefaultPolicyEvaluator for strict external authorization.
 */
function hasRoleBinding(
  matchBindings: CoordinationIntent["matchBindings"],
  role: OperationTemplate["requiredRoles"][number],
): boolean {
  return matchBindings.some((binding) => binding.role === role);
}

export function templateAwarePolicyEvaluator(): PolicyEvaluator {
  return {
    evaluate(input) {
      if (input.intent.operationTypeId !== input.template.operationTypeId) {
        return {
          kind: "deny",
          reason: `operation type mismatch: intent ${String(input.intent.operationTypeId)} vs template ${String(input.template.operationTypeId)}`,
        };
      }

      const initiator = input.snapshot.participants.get(input.intent.initiator.actorId);
      if (initiator === undefined) {
        return {
          kind: "deny",
          reason: `initiator ${String(input.intent.initiator.actorId)} not found in participants`,
        };
      }
      if (initiator.status !== "active") {
        return {
          kind: "deny",
          reason: `initiator ${String(input.intent.initiator.actorId)} status is ${initiator.status}, not active`,
        };
      }

      for (const role of input.template.requiredRoles) {
        if (!hasRoleBinding(input.intent.matchBindings, role)) {
          return { kind: "deny", reason: `missing required role binding: ${role}` };
        }
      }

      return { kind: "allow", authorization: [] };
    },
  };
}
