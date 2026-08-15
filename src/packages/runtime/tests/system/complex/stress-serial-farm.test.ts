import { describe, expect, it } from "vitest";
import { artifactId, validateBeforeRefChain, validateSnapshotIntegrity } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { RUNTIME_SCALE, buildRuntimeLargeWorld } from "../../support/scenario/largeWorld.js";
import { runSerialIntroduceFarm } from "../../support/scenario/scenarioRunner.js";

describe("stress serial introduce farm", () => {
  it("commits 50 disjoint tasks on a 100-agent world with full replay", () => {
    const farmSize = RUNTIME_SCALE.stressFarm;
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.stressAgents);
    const eventCount = farmSize + 4;
    const { runtime, t0 } = buildTestRuntime({ initial: world, eventCount });

    const changes = runSerialIntroduceFarm(runtime, farmSize);
    const head = runtime.getHead();

    expect(changes).toHaveLength(farmSize);
    validateBeforeRefChain(changes);
    if (head !== undefined) {
      validateSnapshotIntegrity(head);
      expect(head.artifacts.size).toBe(farmSize);
      expect(head.artifacts.has(artifactId(`task-${farmSize - 1}`))).toBe(true);
    }

    const replay = runtime.replay({ fromRef: t0.snapshotRef });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.steps).toHaveLength(farmSize);
    }
  });
});
