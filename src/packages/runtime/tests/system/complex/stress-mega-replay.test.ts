import { describe, expect, it } from "vitest";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { RUNTIME_SCALE, buildRuntimeLargeWorld } from "../../support/scenario/largeWorld.js";
import { runRuntimeEngineeringClosure } from "../../support/scenario/engineeringHarness.js";

describe("stress mega replay closure", () => {
  it("runs farm + loop + observations on 100-agent world and replays from T0", () => {
    const farm = RUNTIME_SCALE.stressFarm;
    const loopRounds = RUNTIME_SCALE.stressLoopRounds;
    const eventCount = farm + loopRounds * 2 + RUNTIME_SCALE.stressObs + 8;
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.stressAgents);
    const { runtime, t0, changelog } = buildTestRuntime({ initial: world, eventCount });

    const closure = runRuntimeEngineeringClosure(runtime, changelog, t0, {
      farm,
      loopRounds,
      observations: RUNTIME_SCALE.stressObs,
      agentCount: RUNTIME_SCALE.stressAgents,
    });

    expect(closure.replayOk).toBe(true);
    expect(closure.replaySteps).toBe(farm + loopRounds * 2);
    expect(closure.head?.artifacts.size).toBe(farm + loopRounds);
    expect(closure.head?.auditTail.length).toBe(RUNTIME_SCALE.stressObs);
  });
});
