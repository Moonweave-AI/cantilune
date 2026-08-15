import { describe, expect, it } from "vitest";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { buildRuntimeLargeWorld, RUNTIME_SCALE } from "../../support/scenario/runtimeLargeWorld.js";
import {
  runUltimateRuntimeClosure,
  ultimateExpectedArtifactCount,
  ultimateRuntimeEventCount,
} from "../../support/scenario/ultimateHarness.js";
import { observeCommittedExplicit } from "../../support/scenario/observabilityHarness.js";
import { OBS_SCALE } from "../../support/scenario/largeWorld.js";

describe("ultimate observability closure", () => {
  it("folds ultimate runtime trajectory into FourViewBundle with full cross-view invariants", () => {
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.extremeAgents);
    const deps = buildTestRuntime({ initial: world, eventCount: ultimateRuntimeEventCount() + 32 });

    const runtimeClosure = runUltimateRuntimeClosure(deps.runtime, deps.changelog, deps.t0);
    const obsClosure = observeCommittedExplicit(deps);

    expect(runtimeClosure.replayOk).toBe(true);
    expect(runtimeClosure.totalCommits).toBe(OBS_SCALE.ultimateCommits);
    expect(obsClosure.commitCount).toBe(OBS_SCALE.ultimateCommits);
    expect(obsClosure.validation.ok).toBe(true);
    expect(obsClosure.bundle.spine.events).toHaveLength(OBS_SCALE.ultimateCommits);
    expect(obsClosure.bundle.resource.byEvent.size).toBe(OBS_SCALE.ultimateCommits);
    expect(obsClosure.bundle.communication.byEvent.size).toBe(OBS_SCALE.ultimateCommits);
    expect(obsClosure.bundle.dependency.byEvent.size).toBe(OBS_SCALE.ultimateCommits);
    expect(obsClosure.bundle.structure.byEvent.size).toBe(OBS_SCALE.ultimateCommits);
    expect(obsClosure.bundle.resource.capabilities.length).toBeGreaterThan(
      ultimateExpectedArtifactCount() - 1,
    );
    expect(obsClosure.bundle.communication.sessions.length).toBeGreaterThan(
      RUNTIME_SCALE.extremeLoopRounds,
    );
    expect(obsClosure.bundle.structure.composition.kind).toBe("serial");
    expect(obsClosure.bundle.diagnostic?.stats.changes).toBe(OBS_SCALE.ultimateCommits);
    const head = deps.runtime.getHead();
    expect(head?.sessions.size).toBeGreaterThan(RUNTIME_SCALE.extremeLoopRounds);
  });
});
