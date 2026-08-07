import { describe, expect, it } from "vitest";
import { timestamp } from "../../../src/primitives/time.js";
import { entityTombstone } from "../../../src/nodes/entityTombstone.js";

describe("entityTombstone", () => {
  it("records retirement without optional reason", () => {
    const tombstone = entityTombstone(
      "participant-retired",
      "participant",
      timestamp("2026-08-07T12:00:00Z"),
    );
    expect(tombstone.entityKind).toBe("participant");
    expect(tombstone).not.toHaveProperty("reasonRef");
  });

  it("includes reasonRef when provided", () => {
    const tombstone = entityTombstone(
      "session-s",
      "session",
      timestamp("2026-08-07T12:00:00Z"),
      "content://retire-reason",
    );
    expect(tombstone.reasonRef).toBe("content://retire-reason");
  });
});
