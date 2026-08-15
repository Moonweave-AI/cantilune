import type { CoordinationRuntime } from "../../src/engine/coordinationRuntime.js";
import { createCoordinationRuntime } from "../../src/engine/coordinationRuntime.js";
import { createDefaultHandlers } from "../../src/execution/handlers/index.js";
import { RunHistoryTracker } from "../../src/engine/runHistoryTracker.js";
import { MemoryResourceLockTable } from "../../src/memory/index.js";
import { createMemoryRuntimePersistence } from "../../src/memory/memoryDurableCoordinator.js";
import { createDefaultSchema } from "../../src/schema/defaultSchema.js";
import { runtimeDependenciesWithStaticSchema } from "../../src/engine/runtimeDependenciesCompat.js";
import { buildConfigT0 } from "./fixtures/config-t0.js";
import { createDeterministicIdGenerator } from "./deterministicIds.js";
import { createFixedClock } from "./fixedClock.js";
import type { CollaborationSnapshot } from "@cantilune/core";
import { runtimeIdConfig } from "./scenario/idPools.js";
import { allowAllPolicyEvaluator } from "./testPolicy.js";
import type { MemoryChangeLog } from "../../src/memory/memoryChangeLog.js";
import type { MemoryCollaborationStore } from "../../src/memory/memoryStore.js";
import type { RecipeSidecar } from "../../src/replay/recipeSidecar.js";
import type { MemoryDurableCoordinator } from "../../src/memory/memoryDurableCoordinator.js";
import type { ContentRefAuthority } from "../../src/ports/contentRefAuthority.js";

const TEST_CONTENT_AUTHORITY: ContentRefAuthority = { isAvailable: () => true };

export function buildTestRuntime(options?: {
  snapshotRefs?: readonly string[];
  changeIds?: readonly string[];
  sessionIds?: readonly string[];
  linkIds?: readonly string[];
  initial?: CollaborationSnapshot;
  eventCount?: number;
  /** Explicit test authority; null exercises production fail-closed wiring. */
  contentRefAuthority?: ContentRefAuthority | null;
}): {
  readonly runtime: CoordinationRuntime;
  readonly durable: MemoryDurableCoordinator;
  readonly store: MemoryCollaborationStore;
  readonly changelog: MemoryChangeLog;
  readonly locks: MemoryResourceLockTable;
  readonly t0: CollaborationSnapshot;
  readonly recipeSidecar: RecipeSidecar;
  readonly runHistory: RunHistoryTracker;
} {
  const pool = options?.eventCount !== undefined ? runtimeIdConfig(options.eventCount) : undefined;
  const t0 = options?.initial ?? buildConfigT0();
  const { durable, store, changelog, sidecar } = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  const runHistory = new RunHistoryTracker();
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({
        snapshotRefs: options?.snapshotRefs ??
          pool?.snapshotRefs ?? ["snap-S1", "snap-S2", "snap-S3", "snap-S-obs"],
        changeIds: options?.changeIds ?? pool?.changeIds ?? ["chg-001", "chg-002", "chg-003"],
        sessionIds: options?.sessionIds ?? pool?.sessionIds ?? ["session-s"],
        linkIds: options?.linkIds ?? ["link-waits-1", "link-nest-1"],
      }),
      schema: createDefaultSchema(),
      activeEpochId: t0.epochId,
      policy: allowAllPolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks,
      runHistory,
      ...(options?.contentRefAuthority === null
        ? {}
        : { contentRefAuthority: options?.contentRefAuthority ?? TEST_CONTENT_AUTHORITY }),
    }),
  );

  return { runtime, durable, store, changelog, locks, t0, recipeSidecar: sidecar, runHistory };
}
