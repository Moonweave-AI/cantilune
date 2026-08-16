import type { ContentDigest } from "@cantilune/core";
import type {
  EvaluationClaimId,
  EvaluationProtocolId,
  AggregateAnalysisId,
} from "../foundation/evaluationIds.js";
import type { ClaimDecisionStatus } from "../foundation/evaluationStatus.js";

/**
 * Claim decision — NEVER a single passed: boolean.
 * Must carry full evidence chain, reviewer attestations,
 * and explicit limitations.
 */
export interface ClaimDecision {
  readonly claimRef: EvaluationClaimId;
  readonly protocolRef: EvaluationProtocolId;
  readonly analysisRefs: readonly AggregateAnalysisId[];
  readonly status: ClaimDecisionStatus;
  readonly guardrailViolations: readonly GuardrailViolation[];
  readonly evidenceRoot: ContentDigest;
  readonly reviewerAttestations: readonly ReviewerAttestation[];
  readonly limitations: readonly string[];
  readonly applicability: string;
  readonly decidedAt: string;
  readonly publishedAt: string | undefined;
  readonly supersedes: EvaluationClaimId | undefined;
  readonly retractionReason: string | undefined;
  readonly signatureRefs: readonly string[];
}

export interface GuardrailViolation {
  readonly metricId: string;
  readonly threshold: number;
  readonly observed: number;
  readonly severity: "warning" | "blocking";
}

export interface ReviewerAttestation {
  readonly reviewerId: string;
  readonly role: string;
  readonly decision: "approve" | "reject" | "abstain";
  readonly rationale: string;
  readonly coiDeclaration: string;
  readonly attestedAt: string;
  readonly signatureRef: string;
}

export interface ReviewValidationConfig {
  readonly requiredRoles: readonly string[];
  readonly requiredCount: number;
  readonly selfReviewProhibited: boolean;
  readonly claimOwnerRef: string;
}

/**
 * A decision is publishable if it can appear in the claim ledger as a reviewed result.
 * Applies to ALL decision statuses — notSupported/inconclusive are publishable as
 * negative/uncertain results; they just cannot support a superiority claim.
 */
export function isDecisionPublishable(
  decision: ClaimDecision,
  config: ReviewValidationConfig,
): boolean {
  const blockingViolations = decision.guardrailViolations.filter((v) => v.severity === "blocking");
  if (blockingViolations.length > 0) return false;

  const reviewResult = validateReviewers(decision.reviewerAttestations, config);
  if (!reviewResult.valid) return false;

  if (decision.reviewerAttestations.some((a) => a.decision === "reject")) return false;
  if (decision.evidenceRoot === ("" as ContentDigest)) return false;
  if (decision.signatureRefs.length === 0) return false;

  return true;
}

/**
 * Only a supported decision with passing reviews can back a superiority claim.
 */
export function supportsSuperiorityClaim(
  decision: ClaimDecision,
  config: ReviewValidationConfig,
): boolean {
  return decision.status === "supported" && isDecisionPublishable(decision, config);
}

export interface ReviewValidationResult {
  readonly valid: boolean;
  readonly reason: string | undefined;
}

export function validateReviewers(
  attestations: readonly ReviewerAttestation[],
  config: ReviewValidationConfig,
): ReviewValidationResult {
  if (config.requiredCount < 1) {
    return { valid: false, reason: "requiredCount must be >= 1" };
  }

  if (attestations.length === 0) {
    return { valid: false, reason: "no reviewer attestations" };
  }

  if (config.selfReviewProhibited) {
    const uniqueReviewerIds = new Set(attestations.map((a) => a.reviewerId));
    if (uniqueReviewerIds.size < attestations.length) {
      return { valid: false, reason: "duplicate reviewer detected" };
    }
    if (attestations.some((a) => a.reviewerId === config.claimOwnerRef)) {
      return { valid: false, reason: "self-review prohibited" };
    }
  } else {
    const uniqueRoleKeys = new Set(attestations.map((a) => `${a.reviewerId}:${a.role}`));
    if (uniqueRoleKeys.size < attestations.length) {
      return { valid: false, reason: "duplicate reviewer role detected" };
    }
  }

  for (const att of attestations) {
    if (att.coiDeclaration === "") {
      return { valid: false, reason: `reviewer ${att.reviewerId} missing COI declaration` };
    }
    if (att.signatureRef === "") {
      return { valid: false, reason: `reviewer ${att.reviewerId} missing signature` };
    }
  }

  const approvals = attestations.filter((a) => a.decision === "approve");
  if (approvals.length < config.requiredCount) {
    return {
      valid: false,
      reason: `insufficient approvals: ${approvals.length} < ${config.requiredCount}`,
    };
  }

  const coveredRoles = new Set(attestations.map((a) => a.role));
  for (const required of config.requiredRoles) {
    if (!coveredRoles.has(required)) {
      return { valid: false, reason: `required role not covered: ${required}` };
    }
  }

  return { valid: true, reason: undefined };
}

/** @deprecated Use isDecisionPublishable with ReviewValidationConfig instead */
export function hasReviewQuorum(decision: ClaimDecision, requiredCount: number): boolean {
  if (requiredCount < 1) return false;
  const uniqueApprovals = new Set(
    decision.reviewerAttestations.filter((a) => a.decision === "approve").map((a) => a.reviewerId),
  );
  return uniqueApprovals.size >= requiredCount;
}
