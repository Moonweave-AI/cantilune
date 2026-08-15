import { describe, it, expect } from "vitest";
import {
  isDecisionPublishable,
  supportsSuperiorityClaim,
  hasReviewQuorum,
  validateReviewers,
  type ReviewValidationConfig,
} from "../../src/review/claimDecision.js";
import type { ClaimDecision } from "../../src/review/claimDecision.js";
import {
  evaluationClaimId,
  evaluationProtocolId,
  aggregateAnalysisId,
} from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const defaultConfig: ReviewValidationConfig = {
  requiredRoles: ["ai-eval"],
  requiredCount: 1,
  selfReviewProhibited: true,
  claimOwnerRef: "owner-1",
};

function makeDecision(overrides: Partial<ClaimDecision> = {}): ClaimDecision {
  return {
    claimRef: evaluationClaimId("c1"),
    protocolRef: evaluationProtocolId("p1"),
    analysisRefs: [aggregateAnalysisId("a1")],
    status: "supported",
    guardrailViolations: [],
    evidenceRoot: "root-digest" as ContentDigest,
    reviewerAttestations: [
      {
        reviewerId: "rev-1",
        role: "ai-eval",
        decision: "approve",
        rationale: "All checks passed",
        coiDeclaration: "none",
        attestedAt: "2026-01-20",
        signatureRef: "sig-1",
      },
    ],
    limitations: [],
    applicability: "all",
    decidedAt: "2026-01-20",
    publishedAt: undefined,
    supersedes: undefined,
    retractionReason: undefined,
    signatureRefs: ["sig-1"],
    ...overrides,
  };
}

describe("ClaimDecision", () => {
  it("supported decision is publishable with valid review", () => {
    const decision = makeDecision();
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(true);
  });

  it("notSupported is publishable as negative result", () => {
    const decision = makeDecision({ status: "notSupported" });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(true);
  });

  it("inconclusive is publishable as uncertain result", () => {
    const decision = makeDecision({ status: "inconclusive" });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(true);
  });

  it("notSupported does NOT support superiority claim", () => {
    const decision = makeDecision({ status: "notSupported" });
    expect(supportsSuperiorityClaim(decision, defaultConfig)).toBe(false);
  });

  it("only supported supports superiority claim", () => {
    const decision = makeDecision({ status: "supported" });
    expect(supportsSuperiorityClaim(decision, defaultConfig)).toBe(true);
  });

  it("is not publishable with blocking guardrail violations", () => {
    const decision = makeDecision({
      guardrailViolations: [
        { metricId: "m1", threshold: 0.9, observed: 0.8, severity: "blocking" },
      ],
    });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(false);
  });

  it("is publishable with warning-only guardrail violations", () => {
    const decision = makeDecision({
      guardrailViolations: [
        { metricId: "m1", threshold: 0.9, observed: 0.85, severity: "warning" },
      ],
    });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(true);
  });

  it("is not publishable with no reviewer attestations", () => {
    const decision = makeDecision({ reviewerAttestations: [] });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(false);
  });

  it("is not publishable if any reviewer rejected", () => {
    const decision = makeDecision({
      reviewerAttestations: [
        {
          reviewerId: "rev-1",
          role: "ai-eval",
          decision: "reject",
          rationale: "Issues found",
          coiDeclaration: "none",
          attestedAt: "2026-01-20",
          signatureRef: "sig-1",
        },
      ],
    });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(false);
  });

  it("is not publishable with empty evidence root", () => {
    const decision = makeDecision({ evidenceRoot: "" as ContentDigest });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(false);
  });

  it("is not publishable with empty signature refs", () => {
    const decision = makeDecision({ signatureRefs: [] });
    expect(isDecisionPublishable(decision, defaultConfig)).toBe(false);
  });

  it("rejects duplicate reviewers", () => {
    const result = validateReviewers(
      [
        {
          reviewerId: "r1",
          role: "ai-eval",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s1",
        },
        {
          reviewerId: "r1",
          role: "stats",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s2",
        },
      ],
      defaultConfig,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("duplicate");
  });

  it("rejects self-review when prohibited", () => {
    const result = validateReviewers(
      [
        {
          reviewerId: "owner-1",
          role: "ai-eval",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s1",
        },
      ],
      defaultConfig,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("self-review");
  });

  it("rejects zero required count", () => {
    const result = validateReviewers(
      [
        {
          reviewerId: "r1",
          role: "ai-eval",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s1",
        },
      ],
      { ...defaultConfig, requiredCount: 0 },
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("requiredCount");
  });

  it("rejects abstain-only reviewers (insufficient approvals)", () => {
    const result = validateReviewers(
      [
        {
          reviewerId: "r1",
          role: "ai-eval",
          decision: "abstain",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s1",
        },
      ],
      defaultConfig,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("insufficient approvals");
  });

  it("rejects reviewer missing COI declaration", () => {
    const result = validateReviewers(
      [
        {
          reviewerId: "r1",
          role: "ai-eval",
          decision: "approve",
          rationale: "",
          coiDeclaration: "",
          attestedAt: "",
          signatureRef: "s1",
        },
      ],
      defaultConfig,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("COI");
  });

  it("rejects reviewer missing signature", () => {
    const result = validateReviewers(
      [
        {
          reviewerId: "r1",
          role: "ai-eval",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "",
        },
      ],
      defaultConfig,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("signature");
  });

  it("rejects when required role not covered", () => {
    const result = validateReviewers(
      [
        {
          reviewerId: "r1",
          role: "stats",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s1",
        },
      ],
      { ...defaultConfig, requiredRoles: ["ai-eval", "stats"] },
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("required role");
  });

  it("checks review quorum with deduplication", () => {
    const decision = makeDecision({
      reviewerAttestations: [
        {
          reviewerId: "r1",
          role: "stats",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s1",
        },
        {
          reviewerId: "r2",
          role: "ai-eval",
          decision: "approve",
          rationale: "",
          coiDeclaration: "none",
          attestedAt: "",
          signatureRef: "s2",
        },
      ],
    });
    expect(hasReviewQuorum(decision, 2)).toBe(true);
    expect(hasReviewQuorum(decision, 3)).toBe(false);
  });

  it("rejects quorum with zero count", () => {
    const decision = makeDecision();
    expect(hasReviewQuorum(decision, 0)).toBe(false);
  });
});
