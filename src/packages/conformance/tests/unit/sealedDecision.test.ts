import { describe, expect, it } from "vitest";
import {
  isReviewedDecision,
  isVerifiedDecision,
  sealReviewedDecision,
  sealVerifiedDecision,
} from "../../src/lifecycle/sealedDecision.js";
import type { VerificationDecision } from "../../src/foundation/verificationDecision.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";
import { verificationRunId } from "../../src/foundation/conformanceId.js";

function verifiedDecision(): VerificationDecision {
  return {
    runId: verificationRunId("run-test-001"),
    profile: "engineeringAdmission",
    status: { ...initialConformanceStatus(), machine: "verified" },
    violations: [],
    evidenceRootDigest: "0000000000000000000000000000000000000000000000000000000000000000",
    decidedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("sealedDecision", () => {
  it("seals verified decision only when machine verified with no violations", () => {
    const sealed = sealVerifiedDecision({
      decision: verifiedDecision(),
      verifiedAt: "2026-01-01T00:00:00.000Z",
      verifierBuild: "conformance/test",
    });
    expect(isVerifiedDecision(sealed)).toBe(true);
    const reviewed = sealReviewedDecision({
      verified: sealed,
      reviewerId: "reviewer-1",
      reviewDecision: "approved",
      reviewedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(isReviewedDecision(reviewed)).toBe(true);
  });

  it("rejects sealing unverified machine decision", () => {
    const decision = verifiedDecision();
    const invalid: VerificationDecision = {
      ...decision,
      status: { ...decision.status, machine: "invalid" },
    };
    expect(() =>
      sealVerifiedDecision({
        decision: invalid,
        verifiedAt: "2026-01-01T00:00:00.000Z",
        verifierBuild: "conformance/test",
      }),
    ).toThrow(/machine status is not verified/);
  });
});
