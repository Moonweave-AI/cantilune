import { describe, expect, it } from "vitest";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { createMemoryRuntimePersistence } from "../../../src/memory/memoryDurableCoordinator.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";
import { introduceIntent } from "../../support/scenario/scenarioRunner.js";
import { RunHistoryTracker } from "../../../src/engine/runHistoryTracker.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";
import {
  snapshotRef,
  actorRef,
  contentRef,
  compositionIntent,
  epochId,
  footprint,
  targetRef,
} from "@cantilune/core";

describe("CoordinationRuntime branches", () => {
  it("returns undefined head when store is empty", () => {
    const { durable } = createMemoryRuntimePersistence();
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
      }),
    );
    expect(runtime.getHead()).toBeUndefined();
  });

  it("requires principal for observe", () => {
    const { durable } = createMemoryRuntimePersistence({ initial: buildConfigT0() });
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
      }),
    );
    const source = actorRef(storyActorIds.human, "human");
    const result = runtime.observe({ source, payloadRef: contentRef("content://obs") });
    expect("code" in result).toBe(true);
  });

  it("returns admission failure from proposeAndCommit without committing", () => {
    const { durable } = createMemoryRuntimePersistence({ initial: buildConfigT0() });
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: {
          evaluate() {
            return { kind: "deny" as const, reason: "denied" };
          },
        },
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
      }),
    );
    const result = runtime.proposeAndCommit(introduceIntent(0));
    expect("ok" in result && result.ok).toBe(false);
  });

  it("passes beforeRef through admit and admitComposition", () => {
    const t0 = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial: t0 });
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
      }),
    );
    const admitted = runtime.admit(introduceIntent(0), { beforeRef: t0.snapshotRef });
    expect(admitted.ok).toBe(true);
    const denied = runtime.admit(introduceIntent(0), { beforeRef: snapshotRef("snap-stale") });
    expect(denied.ok).toBe(false);
  });

  it("passes beforeRef through admitComposition", () => {
    const t0 = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial: t0 });
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
      }),
    );
    const composition = compositionIntent(
      "fork",
      actorRef(storyActorIds.planner, "agent"),
      footprint({ participantIds: [storyActorIds.planner, storyActorIds.coder] }),
      [
        targetRef("participant", storyActorIds.planner),
        targetRef("participant", storyActorIds.coder),
      ],
    );
    const admitted = runtime.admitComposition(composition, { beforeRef: t0.snapshotRef });
    expect(admitted.ok).toBe(true);
  });

  it("records observation in run history when configured", () => {
    const t0 = buildConfigT0();
    const { durable } = createMemoryRuntimePersistence({ initial: t0 });
    const runHistory = new RunHistoryTracker();
    const runtime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator({ snapshotRefs: ["snap-obs"] }),
        schema: createDefaultSchema(),
        activeEpochId: epochId("42"),
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
        runHistory,
        contentRefAuthority: { isAvailable: () => true },
      }),
    );
    const source = actorRef(storyActorIds.human, "human");
    const result = runtime.observe(
      { source, payloadRef: contentRef("content://obs") },
      { principal: source },
    );
    expect("snapshot" in result).toBe(true);
    expect(runHistory.current()).toHaveLength(1);
  });
});
