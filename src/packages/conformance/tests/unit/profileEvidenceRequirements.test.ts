import { describe, expect, it } from "vitest";
import {
  PROFILE_EVIDENCE_REQUIREMENTS,
  profileSatisfiesRequirements,
} from "../../src/foundation/profileEvidenceRequirements.js";

describe("profileEvidenceRequirements", () => {
  it("requires evidence class superset rather than integer rank", () => {
    expect(profileSatisfiesRequirements("fullProductTrajectory", "engineeringAdmission")).toBe(
      true,
    );
    expect(profileSatisfiesRequirements("engineeringAdmission", "fourProjection")).toBe(false);
    expect(profileSatisfiesRequirements("fixedEpochRule", "fixedEpochRule")).toBe(true);
  });

  it("lists C6 replay recipe for fixedEpochRule profile", () => {
    expect(PROFILE_EVIDENCE_REQUIREMENTS.fixedEpochRule).toContain("C6_replayRecipe");
  });
});
