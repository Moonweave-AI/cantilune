import { describe, expect, it } from "vitest";
import {
  actorRef,
  compositionIntent,
  contentRef,
  coordinationIntent,
  footprint,
  matchBinding,
  operationTypeId,
  targetRef,
} from "@cantilune/core";
import { buildTestRuntime } from "../support/buildTestRuntime.js";
import { buildConfigT0, storyActorIds } from "../support/fixtures/config-t0.js";
import { storyEntityIds } from "../support/fixtures/story-entities.js";
import { encodeChangeWithRecipe, decodeChangeWithRecipe } from "../../src/codec/changeCodec.js";
import { matchWitnessFromBindings } from "../../src/replay/matchWitness.js";

describe("extended operator handlers", () => {
  it("create_session opens a session via nest composition", () => {
    const { runtime } = buildTestRuntime({
      snapshotRefs: ["snap-S1"],
      changeIds: ["chg-session"],
      sessionIds: [storyEntityIds.session],
      linkIds: ["link-nest-1"],
    });

    const composition = compositionIntent(
      "nest",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ participantIds: [storyActorIds.planner, storyActorIds.coder] }),
      [
        targetRef("session", storyEntityIds.session),
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
      ],
    );

    const admitted = runtime.admitComposition(composition);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }
    const committed = runtime.commit(admitted.ticket);
    expect("change" in committed).toBe(true);
    if (!("change" in committed)) {
      return;
    }
    expect(committed.change.operationTypeId).toBe(operationTypeId("create_session"));
    expect(committed.after.sessions.has(storyEntityIds.session)).toBe(true);
  });

  it("transfer_session reassigns controller", () => {
    const { runtime } = buildTestRuntime({
      initial: buildConfigT0(),
      snapshotRefs: ["snap-S1", "snap-S2"],
      changeIds: ["chg-create", "chg-transfer"],
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

    const transfer = runtime.proposeAndCommit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("transfer_session"),
        [
          matchBinding("session", storyEntityIds.session),
          matchBinding("from", storyActorIds.planner),
          matchBinding("to", storyActorIds.coder),
        ],
      ),
    );
    expect("change" in transfer).toBe(true);
    if (!("change" in transfer)) {
      return;
    }
    expect(transfer.after.sessions.get(storyEntityIds.session)?.controller).toBe(
      storyActorIds.coder,
    );
  });

  it("round-trips matchWitness via change wire", () => {
    const bindings = [
      matchBinding("task", storyEntityIds.task),
      matchBinding("from", storyActorIds.planner),
    ];
    const witness = matchWitnessFromBindings(bindings);
    const { runtime, recipeSidecar } = buildTestRuntime({
      snapshotRefs: ["snap-S1"],
      changeIds: ["chg-wire"],
    });

    const result = runtime.proposeAndCommit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("introduce_artifact"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("capability", storyEntityIds.writeLock),
        ],
        undefined,
        [contentRef("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
      ),
    );
    expect("change" in result).toBe(true);
    if (!("change" in result)) {
      return;
    }

    const recipe = recipeSidecar.get(result.change.changeId);
    expect(recipe).toBeDefined();
    if (recipe === undefined) {
      return;
    }

    const wire = encodeChangeWithRecipe(result.change, {
      ...recipe,
      matchWitness: witness,
      complementTag: 2,
    });
    const decoded = decodeChangeWithRecipe(wire);
    expect(decoded.recipe.matchWitness).toEqual(witness);
    expect(decoded.recipe.complementTag).toBe(2);
  });
});
