import { describe, expect, it } from "vitest";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import {
  deserializeDurableBundle,
  exportDurableBundle,
  importDurableBundleTyped,
  serializeDurableBundle,
} from "../../../src/memory/durableBundle.js";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";
import { MemoryResourceLockTable } from "../../../src/memory/index.js";
import {
  introduceIntent,
  proposeAndCommitOrThrow,
  replayChainStart,
} from "../../support/scenario/scenarioRunner.js";

const TEST_CONTENT_AUTHORITY = { isAvailable: () => true } as const;

describe("L7 crash-restart", () => {
  it("continues from imported bundle after simulated process crash", () => {
    const { runtime, durable, store, recipeSidecar, t0 } = buildTestRuntime({ eventCount: 16 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    proposeAndCommitOrThrow(runtime, introduceIntent(1));

    const crashBundle = serializeDurableBundle(
      exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef),
    );

    const imported = deserializeDurableBundle(crashBundle);
    expect("code" in imported).toBe(false);
    if ("code" in imported) {
      return;
    }

    const restarted = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable: imported.durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator({
          snapshotRefs: ["snap-R1", "snap-R2"],
          changeIds: ["chg-R1"],
          sessionIds: ["session-R1"],
          linkIds: ["link-R1"],
        }),
        schema: createDefaultSchema(),
        activeEpochId: imported.t0.epochId,
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
        contentRefAuthority: TEST_CONTENT_AUTHORITY,
      }),
    );

    const replayBeforeContinue = restarted.replay({
      fromRef: replayChainStart(imported.changelog, imported.t0),
    });
    expect(replayBeforeContinue.ok).toBe(true);

    proposeAndCommitOrThrow(restarted, introduceIntent(2));

    const afterBundle = importDurableBundleTyped(
      exportDurableBundle(
        imported.durable,
        imported.store,
        imported.sidecar,
        imported.t0.snapshotRef,
      ),
    );
    const finalReplay = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable: afterBundle.durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: afterBundle.t0.epochId,
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
        contentRefAuthority: TEST_CONTENT_AUTHORITY,
      }),
    ).replay({ fromRef: replayChainStart(afterBundle.changelog, afterBundle.t0) });

    expect(finalReplay.ok).toBe(true);
    if (finalReplay.ok) {
      expect(finalReplay.terminal.artifacts.size).toBe(3);
    }
  });
});
