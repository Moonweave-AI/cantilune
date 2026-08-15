import { describe, expect, it } from "vitest";
import { artifactId, capabilityId, validateBeforeRefChain } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import {
  RUNTIME_SCALE,
  buildRuntimeLargeWorld,
  runtimeAgentIds,
} from "../../support/scenario/largeWorld.js";
import {
  introduceIntent,
  proposeAndCommitOrThrow,
  runDelegateRoundRobin,
} from "../../support/scenario/scenarioRunner.js";

describe("delegate round robin", () => {
  it("chains multiple delegate hops on one task through runtime handlers", () => {
    const agents = runtimeAgentIds(RUNTIME_SCALE.agents);
    const hops = 5;
    const eventCount = 2 + hops + 2;
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.agents);
    const { runtime } = buildTestRuntime({ initial: world, eventCount });

    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const delegateChanges = runDelegateRoundRobin(runtime, 0, hops, agents);

    const head = runtime.getHead();
    const finalHolder = agents[(hops - 1) % agents.length];
    expect(head?.artifacts.get(artifactId("task-0"))?.owner.actorId).toBe(finalHolder);
    expect(head?.capabilities.get(capabilityId("write-lock-0"))?.holder).toBe(finalHolder);
    expect(head?.sessions.size).toBe(hops);
    expect(delegateChanges).toHaveLength(hops);
    validateBeforeRefChain(delegateChanges);
  });
});
