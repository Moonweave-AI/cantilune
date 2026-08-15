import { describe, expect, it } from "vitest";
import { coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";

describe("transfer_session admission", () => {
  it("rejects non-controller at admission", () => {
    const { runtime } = buildTestRuntime({
      initial: buildConfigT0(),
      snapshotRefs: ["snap-S1", "snap-S2"],
      changeIds: ["chg-create", "chg-transfer-deny"],
      sessionIds: [storyEntityIds.session],
    });

    runtime.proposeAndCommit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("create_session"),
        [
          matchBinding("from", storyActorIds.planner),
          matchBinding("participant", storyActorIds.coder),
          matchBinding("session", storyEntityIds.session),
        ],
      ),
    );

    const admitted = runtime.admit(
      coordinationIntent(
        actorRef(storyActorIds.coder, "agent"),
        operationTypeId("transfer_session"),
        [
          matchBinding("session", storyEntityIds.session),
          matchBinding("from", storyActorIds.coder),
          matchBinding("to", storyActorIds.coder),
        ],
      ),
    );

    expect(admitted.ok).toBe(false);
    if (admitted.ok) {
      return;
    }
    expect(admitted.reason.kind).toBe("requires_failed");
    if (admitted.reason.kind === "requires_failed") {
      expect(admitted.reason.condition.kind).toBe("session.controller_matches");
    }
  });
});
