import { describe, expect, it } from "vitest";
import { actorRef } from "@cantilune/core";
import {
  actorRefFromSnapshot,
  actorRefsFromSnapshot,
} from "../../../src/execution/participantRef.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";

describe("participantRef", () => {
  /**
   * The kind used to be guessed as "agent", which wrote a claim about a
   * participant that did not exist into replayable event evidence.
   */
  it("refuses to invent a kind for an unknown participant", () => {
    const snapshot = buildConfigT0();
    expect(() => actorRefFromSnapshot(snapshot, "unknown-agent" as never)).toThrow(
      /no such participant/,
    );
  });

  it("uses registered participant kind from snapshot", () => {
    const snapshot = buildConfigT0();
    expect(actorRefFromSnapshot(snapshot, storyActorIds.human)).toEqual(
      actorRef(storyActorIds.human, "human"),
    );
    expect(
      actorRefsFromSnapshot(snapshot, [storyActorIds.planner, storyActorIds.human]),
    ).toHaveLength(2);
  });
});
