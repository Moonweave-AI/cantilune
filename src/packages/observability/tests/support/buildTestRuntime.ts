import type { CollaborationSnapshot, CoordinationChange, SnapshotRef } from "@cantilune/core";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  RunHistoryTracker,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
  type CoordinationRuntime,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { createDeterministicIdGenerator } from "./deterministicIds.js";
import { createFixedClock } from "./fixedClock.js";

export interface ChangeLogLike {
  since(ref: SnapshotRef): readonly CoordinationChange[];
  all(): readonly CoordinationChange[];
}

export interface StoreLike {
  get(ref: SnapshotRef): CollaborationSnapshot | undefined;
}

export function buildTestRuntime(options?: {
  snapshotRefs?: readonly string[];
  changeIds?: readonly string[];
  sessionIds?: readonly string[];
  linkIds?: readonly string[];
  initial?: CollaborationSnapshot;
  eventCount?: number;
}): {
  readonly runtime: CoordinationRuntime;
  readonly store: StoreLike;
  readonly changelog: ChangeLogLike;
  readonly locks: MemoryResourceLockTable;
  readonly t0: CollaborationSnapshot;
  readonly runHistory: RunHistoryTracker;
} {
  const t0 = options?.initial ?? buildConfigT0();
  const { durable, store, changelog } = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  const runHistory = new RunHistoryTracker();
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({
        snapshotRefs: options?.snapshotRefs ?? ["snap-S1", "snap-S2", "snap-S3", "snap-S-obs"],
        changeIds: options?.changeIds ?? ["chg-001", "chg-002", "chg-003"],
        sessionIds: options?.sessionIds ?? ["session-s"],
        linkIds: options?.linkIds ?? ["link-waits-1", "link-nest-1"],
      }),
      schema: createDefaultSchema(),
      activeEpochId: t0.epochId,
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks,
      runHistory,
      contentRefAuthority: { isAvailable: () => true },
    }),
  );

  return { runtime, store, changelog, locks, t0, runHistory };
}
