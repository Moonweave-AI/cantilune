import { describe, expect, it } from "vitest";
import { coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";

describe("concurrent admission lock contention", () => {
  it("rejects overlapping admits before commit releases locks", () => {
    const { runtime } = buildTestRuntime();

    const first = runtime.admit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("introduce_artifact"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
      ),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = runtime.admit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("introduce_artifact"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
      ),
    );

    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.reason.kind).toBe("resource_conflict");
  });
});
