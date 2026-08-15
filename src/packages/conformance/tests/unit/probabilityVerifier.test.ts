import { describe, expect, it } from "vitest";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import {
  computeProbabilityEvidenceDigest,
  verifyProbabilityEvidence,
} from "../../src/verifier/probabilityVerifier.js";

describe("probabilityVerifier", () => {
  it("accepts digest-bound probability bundle", () => {
    const bundle = {
      stableWindow: { windowDigest: computeEvidenceDigest({ facet: "stableWindow" }) },
      fairness: { fairnessDigest: computeEvidenceDigest({ facet: "fairness" }) },
      progress: { progressDigest: computeEvidenceDigest({ facet: "progress" }) },
    };
    const evidenceDigest = computeProbabilityEvidenceDigest(bundle);
    expect(verifyProbabilityEvidence({ bundle, evidenceDigest })).toEqual([]);
  });

  it("rejects tampered probability digest", () => {
    const bundle = {
      stableWindow: { windowDigest: computeEvidenceDigest({ facet: "stableWindow" }) },
      fairness: { fairnessDigest: computeEvidenceDigest({ facet: "fairness" }) },
      progress: { progressDigest: computeEvidenceDigest({ facet: "progress" }) },
    };
    const violations = verifyProbabilityEvidence({
      bundle,
      evidenceDigest: computeEvidenceDigest({ tampered: true }),
    });
    expect(violations.some((v) => v.code === "probability_invalid")).toBe(true);
  });
});
