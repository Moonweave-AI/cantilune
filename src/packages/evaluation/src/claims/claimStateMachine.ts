import type { ClaimStatus } from "../foundation/evaluationStatus.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";

const CLAIM_TRANSITIONS: ReadonlyMap<ClaimStatus, readonly ClaimStatus[]> = new Map([
  ["proposed", ["protocolFrozen"]],
  ["protocolFrozen", ["measured"]],
  ["measured", ["supported", "notSupported", "inconclusive"]],
  ["supported", ["independentlyReviewed"]],
  ["notSupported", ["independentlyReviewed"]],
  ["inconclusive", ["independentlyReviewed"]],
  ["independentlyReviewed", ["published"]],
  ["published", ["superseded", "retracted"]],
  ["superseded", []],
  ["retracted", []],
]);

export function transitionClaim(
  current: ClaimStatus,
  target: ClaimStatus,
): EvaluationResult<ClaimStatus> {
  const allowed = CLAIM_TRANSITIONS.get(current);
  if (!allowed?.includes(target)) {
    return violations([
      violation(
        "invalid_state_transition",
        "claim.status",
        `Cannot transition claim from '${current}' to '${target}'`,
        { current, target, allowed: allowed ?? [] },
      ),
    ]);
  }
  return ok(target);
}

export function isClaimTerminal(status: ClaimStatus): boolean {
  return status === "superseded" || status === "retracted";
}

export function canClaimBePublished(status: ClaimStatus): boolean {
  return status === "independentlyReviewed";
}
