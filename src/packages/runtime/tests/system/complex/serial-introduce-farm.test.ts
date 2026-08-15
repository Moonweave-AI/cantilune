import { describe, expect, it } from "vitest";
import {
  artifactId,
  capabilityId,
  validateBeforeRefChain,
  validateSnapshotIntegrity,
} from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { RUNTIME_SCALE } from "../../support/scenario/largeWorld.js";
import { buildRuntimeLargeWorld } from "../../support/scenario/largeWorld.js";
import { runSerialIntroduceFarm } from "../../support/scenario/scenarioRunner.js";

describe("serial introduce farm", () => {
  it("introduces many disjoint tasks through real admit/commit", () => {
    const farmSize = RUNTIME_SCALE.farm;
    const eventCount = farmSize + 2;
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.agents);
    const { runtime, t0 } = buildTestRuntime({ initial: world, eventCount });

    const changes = runSerialIntroduceFarm(runtime, farmSize);
    const head = runtime.getHead();

    expect(changes).toHaveLength(farmSize);
    expect(head?.artifacts.size).toBe(farmSize);
    expect(head?.capabilities.size).toBe(farmSize);
    validateBeforeRefChain(changes);
    if (head !== undefined) {
      validateSnapshotIntegrity(head);
    }

    for (let index = 0; index < farmSize; index++) {
      expect(head?.artifacts.has(artifactId(`task-${index}`))).toBe(true);
      expect(head?.capabilities.has(capabilityId(`write-lock-${index}`))).toBe(true);
    }

    const replay = runtime.replay({ fromRef: t0.snapshotRef });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.steps).toHaveLength(farmSize);
    }
  });
});
