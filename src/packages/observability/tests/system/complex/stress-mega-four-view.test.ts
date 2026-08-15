import { describe, expect, it } from "vitest";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { buildRuntimeLargeWorld, RUNTIME_SCALE } from "../../support/scenario/runtimeLargeWorld.js";
import { runRuntimeEngineeringClosure } from "../../support/scenario/engineeringHarness.js";
import { observeCommittedExplicit } from "../../support/scenario/observabilityHarness.js";
import { OBS_SCALE } from "../../support/scenario/largeWorld.js";

describe("stress mega four-view closure", () => {
  it("projects stress-scale runtime closure through four views with E1–E7 pass", () => {
    const farm = RUNTIME_SCALE.stressFarm;
    const loopRounds = RUNTIME_SCALE.stressLoopRounds;
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.stressAgents);
    const deps = buildTestRuntime({ initial: world, eventCount: farm + loopRounds * 2 + 16 });

    const runtimeClosure = runRuntimeEngineeringClosure(deps.runtime, deps.changelog, deps.t0, {
      farm,
      loopRounds,
      observations: RUNTIME_SCALE.stressObs,
      agentCount: RUNTIME_SCALE.stressAgents,
    });

    const obsClosure = observeCommittedExplicit(deps);

    expect(runtimeClosure.replayOk).toBe(true);
    expect(obsClosure.commitCount).toBe(OBS_SCALE.stressCommits);
    expect(obsClosure.validation.ok).toBe(true);
    expect(obsClosure.bundle.spine.events).toHaveLength(OBS_SCALE.stressCommits);
    expect(obsClosure.bundle.resource.capabilities.length).toBeGreaterThan(0);
    expect(obsClosure.bundle.communication.sessions.length).toBeGreaterThan(0);
    expect(obsClosure.bundle.dependency.byEvent.size).toBe(OBS_SCALE.stressCommits);
    expect(obsClosure.bundle.structure.byEvent.size).toBe(OBS_SCALE.stressCommits);
    expect(obsClosure.bundle.diagnostic?.stats.changes).toBe(OBS_SCALE.stressCommits);
  });
});
