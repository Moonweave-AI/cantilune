/**
 * Owner-authorized public-claim quorum (2026-08-16).
 *
 * Joker-of-Gotham covers Architecture, Security, QA-L5, and AI-Eval with COI.
 * Analysis still cannot emit `supported`; only an attested ClaimDecision can.
 */
import {
  isDecisionPublishable,
  supportsSuperiorityClaim,
  type ClaimDecision,
  type ReviewerAttestation,
  type ReviewValidationConfig,
} from "./claimDecision.js";

export const OWNER_PUBLIC_REVIEWER_ID = "Joker-of-Gotham";

export const OWNER_COI_PUBLIC_REVIEW_CONFIG: ReviewValidationConfig = {
  requiredRoles: ["architecture", "security", "qa-l5", "ai-eval"],
  requiredCount: 4,
  selfReviewProhibited: false,
  claimOwnerRef: OWNER_PUBLIC_REVIEWER_ID,
};

const ROLES = ["architecture", "security", "qa-l5", "ai-eval"] as const;

export function ownerCoiAttestations(attestedAt: string): readonly ReviewerAttestation[] {
  return ROLES.map((role) => ({
    reviewerId: OWNER_PUBLIC_REVIEWER_ID,
    role,
    decision: "approve" as const,
    rationale: "Owner-authorized public evaluation claim under disclosed COI (FCP 2026-08-16)",
    coiDeclaration:
      "Owner is also DRI; independence waived in docs/governance/fcp-entry-2026-08-16.md",
    attestedAt,
    signatureRef: `owner-coi:${role}:2026-08-16`,
  }));
}

export function isOwnerCoiPublicClaimPublishable(decision: ClaimDecision): boolean {
  return isDecisionPublishable(decision, OWNER_COI_PUBLIC_REVIEW_CONFIG);
}

export function ownerCoiSupportsSuperiorityClaim(decision: ClaimDecision): boolean {
  return supportsSuperiorityClaim(decision, OWNER_COI_PUBLIC_REVIEW_CONFIG);
}
