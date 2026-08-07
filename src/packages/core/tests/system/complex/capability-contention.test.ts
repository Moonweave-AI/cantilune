import { describe, expect, it } from "vitest";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import { buildCapabilityConflictIntents } from "../../support/fixtures/composition/capability-conflict.js";

describe("capability contention", () => {
  it("rejects concurrent intents that share a scoped capability", () => {
    const { planner, coder } = buildCapabilityConflictIntents();
    expect(compatibleConcurrently(planner, coder)).toBe(false);
  });
});
