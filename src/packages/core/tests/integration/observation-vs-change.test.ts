import { describe, expect, it } from "vitest";
import { appendObservation } from "../../src/coordination/collaborationSnapshot.js";
import { buildConfigT0, storyActorIds } from "../support/fixtures/standard-story/config-t0.js";
import { contentRef } from "../../src/primitives/refs.js";
import { timestamp } from "../../src/primitives/time.js";
import { actorRef } from "../../src/nodes/participant.js";
import { assertObservationSeparation } from "../support/assertions/invariants.js";

describe("observation vs change", () => {
  it("keeps external observations separate from graph rewrites", () => {
    const before = buildConfigT0();
    const after = appendObservation(before, {
      source: actorRef(storyActorIds.human, "human"),
      payloadRef: contentRef("content://req-login"),
      receivedAt: timestamp("2026-08-07T10:00:00Z"),
    });

    assertObservationSeparation(before, after);
    expect(after.auditTail).toHaveLength(1);
    expect(before.artifacts.size).toBe(0);
    expect(after.artifacts.size).toBe(0);
  });
});
