import { describe, it, expect } from "vitest";
import type { ContentDigest } from "@cantilune/core";
import {
  evaluationClaimId,
  evaluationProtocolId,
  aggregateAnalysisId,
} from "../../src/foundation/evaluationIds.js";
import type { ClaimDecision } from "../../src/review/claimDecision.js";
import { validateReviewers } from "../../src/review/claimDecision.js";
import {
  OWNER_COI_PUBLIC_REVIEW_CONFIG,
  OWNER_PUBLIC_REVIEWER_ID,
  isOwnerCoiPublicClaimPublishable,
  ownerCoiAttestations,
  ownerCoiSupportsSuperiorityClaim,
} from "../../src/review/ownerCoiPublicClaim.js";

function makeDecision(overrides: Partial<ClaimDecision> = {}): ClaimDecision {
  return {
    claimRef: evaluationClaimId("c1"),
    protocolRef: evaluationProtocolId("p1"),
    analysisRefs: [aggregateAnalysisId("a1")],
    status: "supported",
    guardrailViolations: [],
    evidenceRoot: "root-digest" as ContentDigest,
    reviewerAttestations: ownerCoiAttestations("2026-08-16"),
    limitations: ["Owner COI; analysis never emitted supported"],
    applicability: "FCP-open 0.x window",
    decidedAt: "2026-08-16",
    publishedAt: undefined,
    supersedes: undefined,
    retractionReason: undefined,
    signatureRefs: ["owner-coi:2026-08-16"],
    ...overrides,
  };
}

describe("ownerCoiPublicClaim", () => {
  it("allows one Owner to cover four roles when self-review is not prohibited", () => {
    const result = validateReviewers(
      ownerCoiAttestations("2026-08-16"),
      OWNER_COI_PUBLIC_REVIEW_CONFIG,
    );
    expect(result.valid).toBe(true);
    expect(OWNER_COI_PUBLIC_REVIEW_CONFIG.selfReviewProhibited).toBe(false);
    expect(OWNER_COI_PUBLIC_REVIEW_CONFIG.claimOwnerRef).toBe(OWNER_PUBLIC_REVIEWER_ID);
  });

  it("rejects the same Owner covering the same role twice", () => {
    const attestations = [
      ...ownerCoiAttestations("2026-08-16"),
      {
        reviewerId: OWNER_PUBLIC_REVIEWER_ID,
        role: "ai-eval",
        decision: "approve" as const,
        rationale: "duplicate",
        coiDeclaration: "Owner COI",
        attestedAt: "2026-08-16",
        signatureRef: "dup",
      },
    ];
    const result = validateReviewers(attestations, OWNER_COI_PUBLIC_REVIEW_CONFIG);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("duplicate reviewer role");
  });

  it("publishes an attested supported decision under Owner COI quorum", () => {
    const decision = makeDecision();
    expect(isOwnerCoiPublicClaimPublishable(decision)).toBe(true);
    expect(ownerCoiSupportsSuperiorityClaim(decision)).toBe(true);
  });

  it("does not treat analysis-only notSupported as a superiority claim", () => {
    const decision = makeDecision({ status: "notSupported" });
    expect(isOwnerCoiPublicClaimPublishable(decision)).toBe(true);
    expect(ownerCoiSupportsSuperiorityClaim(decision)).toBe(false);
  });
});
