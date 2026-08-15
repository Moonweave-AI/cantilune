import { describe, expect, it } from "vitest";
import * as conformance from "../../src/index.js";
import * as canonical from "../../src/canonical/index.js";
import * as lifecycle from "../../src/lifecycle/index.js";

describe("L2 package exports", () => {
  it("exports core engine and verifier entry points", () => {
    expect(typeof conformance.createConformanceEngine).toBe("function");
    expect(typeof conformance.verifyDpoReplayWithPort).toBe("function");
    expect(typeof conformance.validateSealedAdmissionPrepare).toBe("function");
  });

  it("exports recipe chain digest helpers from canonical subpath", () => {
    expect(typeof canonical.formatRecipeChainRef).toBe("function");
    expect(typeof canonical.computeReplayRecipeChainDigest).toBe("function");
  });

  it("does not export test-only review builder from production root", () => {
    expect(
      "buildReviewedEngineeringAdmissionForTest" in conformance &&
        typeof (conformance as Record<string, unknown>).buildReviewedEngineeringAdmissionForTest ===
          "function",
    ).toBe(false);
  });

  it("exports sealed decision guards from lifecycle subpath", () => {
    expect(typeof lifecycle.isReviewedDecision).toBe("function");
    expect(typeof lifecycle.sealVerifiedDecision).toBe("function");
  });
});
