import { describe, expect, it } from "vitest";
import { contentRef, validateBeforeRefChain, validateEpochConsistent } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import {
  RUNTIME_SCALE,
  buildRuntimeLargeWorld,
  runtimeActors,
  runtimeAgentIds,
} from "../../support/scenario/largeWorld.js";
import {
  runIntroduceDelegateLoop,
  runSerialIntroduceFarm,
  replayChainStart,
} from "../../support/scenario/scenarioRunner.js";

describe("large replay closure", () => {
  it("replays a combined farm + loop scenario from T0", () => {
    const farmSize = 6;
    const loopRounds = 4;
    const agents = runtimeAgentIds(RUNTIME_SCALE.agents);
    const eventCount = farmSize + loopRounds * 2 + 8;
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.agents);
    const { runtime, t0, changelog } = buildTestRuntime({ initial: world, eventCount });

    for (let index = 0; index < RUNTIME_SCALE.storm; index++) {
      const source = actorRef(runtimeActors.human, "human");
      runtime.observe(
        {
          source,
          payloadRef: contentRef(`content://storm-${index}`),
        },
        { principal: source },
      );
    }

    const farmChanges = runSerialIntroduceFarm(runtime, farmSize);
    const loopChanges = runIntroduceDelegateLoop(runtime, loopRounds, agents, farmSize);
    const allChanges = [...farmChanges, ...loopChanges];

    validateBeforeRefChain(allChanges);
    validateEpochConsistent(allChanges);
    expect(changelog.all()).toHaveLength(allChanges.length);

    const replay = runtime.replay({ fromRef: replayChainStart(changelog, t0) });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.steps).toHaveLength(allChanges.length);
      expect(replay.terminal?.artifacts.size).toBe(farmSize + loopRounds);
    }
  });
});
