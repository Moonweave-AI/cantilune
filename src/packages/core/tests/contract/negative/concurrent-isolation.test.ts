import { describe, expect, it } from "vitest";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import { buildCapabilityConflictIntents } from "../../support/fixtures/composition/capability-conflict.js";

describe("N3 concurrent isolation violations", () => {
  it("rejects parallel composition when write-lock capability overlaps", () => {
    const { planner, coder } = buildCapabilityConflictIntents();
    expect(compatibleConcurrently(planner, coder)).toBe(false);
  });
});
