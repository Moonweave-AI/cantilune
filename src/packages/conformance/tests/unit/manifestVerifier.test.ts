import { describe, expect, it } from "vitest";
import { validateConformanceTargetManifest } from "../../src/verifier/manifestVerifier.js";
import { sampleManifest } from "../support/conformanceFixtures.js";

describe("manifestVerifier branches", () => {
  it("flags all required manifest field violations", () => {
    const violations = validateConformanceTargetManifest(
      sampleManifest({
        proofManifestRef: "",
        policyRef: "" as never,
        theoryBaselineRef: "" as never,
        ownerRef: "",
        requiredReviewerRoles: [],
      }),
    );
    expect(violations.length).toBeGreaterThanOrEqual(5);
  });
});
