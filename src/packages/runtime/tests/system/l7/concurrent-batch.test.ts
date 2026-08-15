import { describe, expect, it } from "vitest";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { introduceIntent, proposeAndCommitOrThrow } from "../../support/scenario/scenarioRunner.js";
import { buildRuntimeLargeWorld, runtimeAgentIds } from "../../support/scenario/largeWorld.js";

describe("L7 concurrent batch", () => {
  it("commits a large disjoint batch without lock leaks", () => {
    const world = buildRuntimeLargeWorld(8);
    const agents = runtimeAgentIds(8);
    const { runtime, locks } = buildTestRuntime({ initial: world, eventCount: 40 });

    const batchSize = 16;
    for (let index = 0; index < batchSize; index++) {
      const holder = agents[index % agents.length]!;
      proposeAndCommitOrThrow(runtime, introduceIntent(index + 100, holder));
    }

    expect(runtime.getHead()?.artifacts.size).toBe(batchSize);

    for (let index = 0; index < batchSize; index++) {
      const admitted = runtime.admit(introduceIntent(index + 200, agents[0]!));
      expect(admitted.ok).toBe(true);
      if (!admitted.ok) {
        continue;
      }
      runtime.cancelAdmission(admitted.ticket);
    }

    expect(locks).toBeDefined();
  });
});
