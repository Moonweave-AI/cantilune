import { describe, expect, it } from "vitest";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { buildRuntimeLargeWorld, RUNTIME_SCALE } from "../../support/scenario/largeWorld.js";
import {
  runUltimateRuntimeClosure,
  ultimateExpectedArtifactCount,
  ultimateRuntimeEventCount,
} from "../../support/scenario/ultimateHarness.js";

describe("ultimate runtime closure", () => {
  it("runs obs + farm + concurrent re-admit + loop + multi-task round-robin + codec + replay", () => {
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.extremeAgents);
    const eventCount = ultimateRuntimeEventCount();
    const { runtime, t0, changelog } = buildTestRuntime({ initial: world, eventCount });

    const closure = runUltimateRuntimeClosure(runtime, changelog, t0);
    const expectedRoundRobin = RUNTIME_SCALE.extremeRoundRobinHops.reduce(
      (sum, hops) => sum + hops,
      0,
    );
    const expectedCommits =
      RUNTIME_SCALE.extremeFarm + RUNTIME_SCALE.extremeLoopRounds * 2 + expectedRoundRobin;

    expect(closure.observationCount).toBe(RUNTIME_SCALE.extremeObs);
    expect(closure.farmCommits).toBe(RUNTIME_SCALE.extremeFarm);
    expect(closure.concurrentExtraCommits).toBe(2);
    expect(closure.loopCommits).toBe(RUNTIME_SCALE.extremeLoopRounds * 2);
    expect(closure.roundRobinCommits).toBe(expectedRoundRobin);
    expect(closure.totalCommits).toBe(expectedCommits);
    expect(closure.replayOk).toBe(true);
    expect(closure.replaySteps).toBe(expectedCommits);
    expect(closure.codecRoundTrips).toBe(expectedCommits);
    expect(closure.snapshotCodecOk).toBe(true);
    expect(closure.changelogTailLength).toBeGreaterThan(expectedCommits / 2);
    expect(closure.head?.artifacts.size).toBe(ultimateExpectedArtifactCount());
    expect(closure.head?.auditTail.length).toBe(RUNTIME_SCALE.extremeObs);
  });
});
