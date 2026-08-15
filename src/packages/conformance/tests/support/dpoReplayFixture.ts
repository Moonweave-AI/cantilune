import {
  actorRef,
  contentRef,
  coordinationIntent,
  epochId,
  matchBinding,
  operationTypeId,
  type CollaborationSnapshot,
  type CoordinationChange,
} from "@cantilune/core";
import {
  createActiveSchemaContext,
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  createReplayVerifier,
  runtimeDependenciesWithStaticSchema,
  RunHistoryTracker,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { buildConfigT0, storyActorIds } from "@cantilune/test-fixtures";
import { createRuntimeDpoReplayPort } from "../../src/adapters/runtime/runtimeDpoReplayPort.js";
import { replayRecipeToSnapshot } from "../../src/adapters/runtime/replayRecipeSnapshot.js";
import {
  computeReplayRecipeChainDigest,
  formatRecipeChainRef,
} from "../../src/canonical/replayRecipeChainDigest.js";
import { allowAllPolicyEvaluator } from "./runtimeTestPolicy.js";
import { createDeterministicIdGenerator, createFixedClock } from "./deterministicIds.js";

function introduceIntent(taskIndex: number) {
  const digest = taskIndex.toString(16).padStart(64, "0").slice(-64);
  return coordinationIntent(
    actorRef(storyActorIds.planner, "agent"),
    operationTypeId("introduce_artifact"),
    [
      matchBinding("task", `task-${taskIndex}`),
      matchBinding("from", storyActorIds.planner),
      matchBinding("capability", `write-lock-${taskIndex}`),
    ],
    undefined,
    [contentRef(`sha256:${digest}`)],
  );
}

export function buildCommittedDpoReplayFixture(): {
  readonly t0: CollaborationSnapshot;
  readonly changes: readonly CoordinationChange[];
  readonly replayPort: ReturnType<typeof createRuntimeDpoReplayPort>;
  readonly recipeChainRef: string;
} {
  const t0 = buildConfigT0();
  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  const runHistory = new RunHistoryTracker();
  const schema = createDefaultSchema();
  const handlers = createDefaultHandlers();
  const schemaContext = createActiveSchemaContext(schema, epochId("42"));
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      schema,
      activeEpochId: t0.epochId,
      handlers,
      locks,
      runHistory,
      policy: allowAllPolicyEvaluator(),
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({
        snapshotRefs: ["snap-S1", "snap-S2", "snap-S3"],
        changeIds: ["chg-001", "chg-002"],
      }),
      contentRefAuthority: { isAvailable: () => true },
    }),
  );
  const committed = runtime.proposeAndCommit(introduceIntent(0));
  if (!("change" in committed)) {
    throw new Error(`fixture commit failed: ${JSON.stringify(committed)}`);
  }
  const changes = durable.since(t0.snapshotRef);
  const replayPort = createRuntimeDpoReplayPort({
    durable,
    handlers,
    schemaContext,
  });
  const direct = createReplayVerifier({ durable, handlers, schemaContext }).verify({
    fromRef: t0.snapshotRef,
  });
  if (!direct.ok) {
    throw new Error(`fixture replay failed: ${direct.violation.message}`);
  }
  const recipeChainRef = formatRecipeChainRef(
    computeReplayRecipeChainDigest({
      changes,
      resolveRecipe: (change) => {
        const recipe = durable.recipeForChange(change);
        if (recipe === undefined) {
          throw new Error(`missing recipe for ${change.changeId}`);
        }
        return replayRecipeToSnapshot(change, recipe);
      },
    }),
  );
  return { t0, changes, replayPort, recipeChainRef };
}
