import { describe, it, expect } from "vitest";
import { BOOT_EPOCH_ID } from "@cantilune/boot";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  runtimeDependenciesWithStaticSchema,
  RunHistoryTracker,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { createCliInitialSnapshot } from "../../src/cliWorld.js";
import { createObserveController } from "../../src/wiring/observeControl.js";
import { createReplayController } from "../../src/wiring/replayControl.js";
import { diffSnapshotsByRef } from "../../src/wiring/worldDiff.js";

function bootTestRuntime() {
  const t0 = createCliInitialSnapshot("cli-test", "human");
  const persistence = createMemoryRuntimePersistence({ initial: t0 });
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable: persistence.durable,
      clock: { now: () => new Date().toISOString() },
      idGen: {
        changeId: () => crypto.randomUUID() as never,
        observationId: () => crypto.randomUUID() as never,
        snapshotRef: () => crypto.randomUUID() as never,
        sessionId: () => crypto.randomUUID() as never,
        linkId: () => crypto.randomUUID() as never,
        artifactId: () => crypto.randomUUID() as never,
        capabilityId: () => crypto.randomUUID() as never,
        evidenceId: () => crypto.randomUUID() as never,
      },
      schema: createDefaultSchema(),
      activeEpochId: BOOT_EPOCH_ID,
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks: new MemoryResourceLockTable(),
      runHistory: new RunHistoryTracker(),
    }),
  );
  return { runtime, durable: persistence.durable, t0 };
}

describe("observe/replay/world-diff controllers", () => {
  it("projects a FourViewBundle via observability for an empty cut", () => {
    const { runtime, durable } = bootTestRuntime();
    const controller = createObserveController({
      coordinationRuntime: () => runtime,
      getSnapshot: (ref) => durable.get(ref as never),
    });
    const result = controller.observe();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection.summary.some((row) => row.lens === "dependency")).toBe(true);
    expect(result.projection.headRef).toBe(String(runtime.getHead()?.snapshotRef));
  });

  it("replays from genesis via CoordinationRuntime.replay", () => {
    const { runtime } = bootTestRuntime();
    const controller = createReplayController({
      coordinationRuntime: () => runtime,
    });
    const result = controller.replay({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection.ok).toBe(true);
    expect(result.projection.fromRef.length).toBeGreaterThan(0);
  });

  it("diffs two snapshot refs fail-closed when missing", () => {
    const { durable, t0 } = bootTestRuntime();
    const missing = diffSnapshotsByRef(
      { getSnapshot: (ref) => durable.get(ref as never) },
      { refA: "snap:missing", refB: String(t0.snapshotRef) },
    );
    expect(missing.ok).toBe(false);

    const ok = diffSnapshotsByRef(
      {
        getSnapshot: (ref) => durable.get(ref as never),
        headRef: () => String(t0.snapshotRef),
      },
      { refA: String(t0.snapshotRef), refB: "head" },
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.left).toContain(String(t0.snapshotRef));
    expect(ok.right).toContain(String(t0.snapshotRef));
  });
});
