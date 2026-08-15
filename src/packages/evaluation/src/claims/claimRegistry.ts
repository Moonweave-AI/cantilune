import type { EvaluationClaimId, EvaluationProtocolId } from "../foundation/evaluationIds.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";
import type { EvaluationClaim, EvaluationProtocol } from "./evaluationClaim.js";
import { transitionClaim } from "./claimStateMachine.js";
import {
  _mintFrozenProtocolToken,
  type FrozenEvaluationProtocol,
} from "../foundation/opaqueTokens.js";
import {
  isDecisionPublishable,
  type ReviewValidationConfig,
  type ClaimDecision,
} from "../review/claimDecision.js";

/** Allowed claim codes — namespaced to avoid collision with conformance C0–C9 */
const VALID_CLAIM_CODES = new Set([
  "evaluation.c1",
  "evaluation.c2",
  "evaluation.c3",
  "evaluation.c4",
  "evaluation.c5",
]);

export interface ClaimRegistry {
  registerClaim(claim: EvaluationClaim): EvaluationResult<EvaluationClaim>;
  getClaim(claimId: EvaluationClaimId): EvaluationClaim | undefined;
  listClaims(): readonly EvaluationClaim[];
  registerProtocol(protocol: EvaluationProtocol): EvaluationResult<EvaluationProtocol>;
  getProtocol(protocolId: EvaluationProtocolId): EvaluationProtocol | undefined;
  freezeProtocol(
    protocolId: EvaluationProtocolId,
    frozenAt: string,
  ): EvaluationResult<FrozenEvaluationProtocol>;
  recordMeasurement(
    claimId: EvaluationClaimId,
    analysisRef: string,
  ): EvaluationResult<EvaluationClaim>;
  decideClaim(
    claimId: EvaluationClaimId,
    decision: ClaimDecision,
  ): EvaluationResult<EvaluationClaim>;
  attestDecision(
    claimId: EvaluationClaimId,
    config: ReviewValidationConfig,
    decision: ClaimDecision,
  ): EvaluationResult<EvaluationClaim>;
}

export function createClaimRegistry(): ClaimRegistry {
  const claims = new Map<string, EvaluationClaim>();
  const protocols = new Map<string, EvaluationProtocol>();

  function deepFreezeClaim(claim: EvaluationClaim): EvaluationClaim {
    return structuredClone(claim);
  }

  function deepFreezeProtocol(protocol: EvaluationProtocol): EvaluationProtocol {
    return structuredClone(protocol);
  }

  return {
    registerClaim(claim: EvaluationClaim): EvaluationResult<EvaluationClaim> {
      if (claims.has(claim.claimId)) {
        return violations([
          violation("invalid_input", "claim.claimId", `Claim already registered: ${claim.claimId}`),
        ]);
      }
      if (!VALID_CLAIM_CODES.has(claim.claimCode)) {
        return violations([
          violation(
            "invalid_input",
            "claim.claimCode",
            `Invalid claim code: ${claim.claimCode}. Must be one of: ${[...VALID_CLAIM_CODES].join(", ")}`,
          ),
        ]);
      }
      const stored = deepFreezeClaim(claim);
      claims.set(claim.claimId, stored);
      return ok(stored);
    },

    getClaim(claimId: EvaluationClaimId): EvaluationClaim | undefined {
      const c = claims.get(claimId);
      return c !== undefined ? deepFreezeClaim(c) : undefined;
    },

    listClaims(): readonly EvaluationClaim[] {
      return [...claims.values()].map(deepFreezeClaim);
    },

    registerProtocol(protocol: EvaluationProtocol): EvaluationResult<EvaluationProtocol> {
      if (protocols.has(protocol.protocolId)) {
        return violations([
          violation(
            "invalid_input",
            "protocol.protocolId",
            `Protocol already registered: ${protocol.protocolId}`,
          ),
        ]);
      }
      const stored = deepFreezeProtocol(protocol);
      protocols.set(protocol.protocolId, stored);
      return ok(stored);
    },

    getProtocol(protocolId: EvaluationProtocolId): EvaluationProtocol | undefined {
      const p = protocols.get(protocolId);
      return p !== undefined ? deepFreezeProtocol(p) : undefined;
    },

    freezeProtocol(
      protocolId: EvaluationProtocolId,
      frozenAt: string,
    ): EvaluationResult<FrozenEvaluationProtocol> {
      const protocol = protocols.get(protocolId);
      if (protocol === undefined) {
        return violations([
          violation("invalid_input", "protocol.protocolId", `Protocol not found: ${protocolId}`),
        ]);
      }
      if (protocol.frozenAt !== undefined) {
        return violations([
          violation(
            "protocol_not_frozen",
            "protocol.frozenAt",
            `Protocol already frozen at ${protocol.frozenAt}`,
          ),
        ]);
      }

      const errs: ReturnType<typeof violation>[] = [];
      for (const claimRef of protocol.claimRefs) {
        if (!claims.has(claimRef)) {
          errs.push(
            violation(
              "invalid_input",
              "protocol.claimRefs",
              `Referenced claim not found: ${claimRef}`,
            ),
          );
        }
      }
      if (errs.length > 0) return violations(errs);

      const frozen = deepFreezeProtocol({ ...protocol, frozenAt });
      protocols.set(protocolId, frozen);

      for (const claimRef of frozen.claimRefs) {
        const claim = claims.get(claimRef);
        if (claim?.status === "proposed") {
          const result = transitionClaim(claim.status, "protocolFrozen");
          if (result.ok) {
            claims.set(
              claimRef,
              deepFreezeClaim({
                ...claim,
                status: result.value,
                frozenAt,
              }),
            );
          }
        }
      }

      return ok(_mintFrozenProtocolToken(frozen.protocolDigest, frozenAt));
    },

    recordMeasurement(
      claimId: EvaluationClaimId,
      analysisRef: string,
    ): EvaluationResult<EvaluationClaim> {
      const claim = claims.get(claimId);
      if (claim === undefined) {
        return violations([
          violation("invalid_input", "claim.claimId", `Claim not found: ${claimId}`),
        ]);
      }
      if (!analysisRef) {
        return violations([
          violation("invalid_input", "analysisRef", "Analysis reference required"),
        ]);
      }
      const result = transitionClaim(claim.status, "measured");
      if (!result.ok) return result as EvaluationResult<EvaluationClaim>;
      const updated = deepFreezeClaim({ ...claim, status: result.value });
      claims.set(claimId, updated);
      return ok(updated);
    },

    decideClaim(
      claimId: EvaluationClaimId,
      decision: ClaimDecision,
    ): EvaluationResult<EvaluationClaim> {
      const claim = claims.get(claimId);
      if (claim === undefined) {
        return violations([
          violation("invalid_input", "claim.claimId", `Claim not found: ${claimId}`),
        ]);
      }
      if (decision.claimRef !== claimId) {
        return violations([
          violation("invalid_input", "decision.claimRef", "Decision claimRef does not match"),
        ]);
      }
      if (decision.analysisRefs.length === 0) {
        return violations([
          violation(
            "invalid_input",
            "decision.analysisRefs",
            "Decision requires at least one analysis ref",
          ),
        ]);
      }

      let targetStatus: "supported" | "notSupported" | "inconclusive" | undefined;
      if (decision.status === "supported") {
        targetStatus = "supported";
      } else if (decision.status === "notSupported") {
        targetStatus = "notSupported";
      } else if (decision.status === "inconclusive") {
        targetStatus = "inconclusive";
      }

      if (targetStatus === undefined) {
        return violations([
          violation(
            "invalid_input",
            "decision.status",
            `Invalid decision status for claim transition: ${decision.status}`,
          ),
        ]);
      }

      const result = transitionClaim(claim.status, targetStatus);
      if (!result.ok) return result as EvaluationResult<EvaluationClaim>;
      const updated = deepFreezeClaim({ ...claim, status: result.value });
      claims.set(claimId, updated);
      return ok(updated);
    },

    attestDecision(
      claimId: EvaluationClaimId,
      config: ReviewValidationConfig,
      decision: ClaimDecision,
    ): EvaluationResult<EvaluationClaim> {
      const claim = claims.get(claimId);
      if (claim === undefined) {
        return violations([
          violation("invalid_input", "claim.claimId", `Claim not found: ${claimId}`),
        ]);
      }

      if (!isDecisionPublishable(decision, config)) {
        return violations([
          violation(
            "review_quorum_not_met",
            "decision.reviewers",
            "Decision does not meet review requirements",
          ),
        ]);
      }

      const result = transitionClaim(claim.status, "independentlyReviewed");
      if (!result.ok) return result as EvaluationResult<EvaluationClaim>;
      const updated = deepFreezeClaim({ ...claim, status: result.value });
      claims.set(claimId, updated);
      return ok(updated);
    },
  };
}
