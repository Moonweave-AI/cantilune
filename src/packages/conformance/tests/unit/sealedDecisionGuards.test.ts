import { describe, expect, it } from "vitest";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";
import { sealReviewedDecision, sealVerifiedDecision } from "../../src/lifecycle/sealedDecision.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { verificationRunId } from "../../src/foundation/conformanceId.js";

describe("sealedDecision guard branches", () => {
  const decision = {
    runId: verificationRunId("run-sealed"),
    profile: "engineeringAdmission" as const,
    status: { ...initialConformanceStatus(), machine: "verified" as const },
    violations: [],
    evidenceRootDigest: computeEvidenceDigest({ sealed: true }),
    decidedAt: "2026-01-01T00:00:00.000Z",
  };

  it("sealVerifiedDecision rejects non-verified machine status", () => {
    expect(() =>
      sealVerifiedDecision({
        decision: { ...decision, status: { ...initialConformanceStatus(), machine: "invalid" } },
        verifiedAt: "2026-01-01T00:00:00.000Z",
        verifierBuild: "test",
      }),
    ).toThrow(/machine status is not verified/);
  });

  it("sealVerifiedDecision rejects violations", () => {
    expect(() =>
      sealVerifiedDecision({
        decision: { ...decision, violations: [{ code: "missing_evidence", message: "v" }] },
        verifiedAt: "2026-01-01T00:00:00.000Z",
        verifierBuild: "test",
      }),
    ).toThrow(/violations present/);
  });

  it("sealReviewedDecision rejects non-verified input", () => {
    expect(() =>
      sealReviewedDecision({
        verified: { fake: true } as never,
        reviewerId: "r",
        reviewDecision: "approved",
        reviewedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow(/not a VerifiedDecision/);
  });
});
