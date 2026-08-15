import { describe, expect, it } from "vitest";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { createReplayVerifier } from "../../../src/execution/replayVerifier.js";
import {
  deserializeDurableBundle,
  exportDurableBundle,
  serializeDurableBundle,
} from "../../../src/memory/durableBundle.js";
import { epochId } from "@cantilune/core";
import { createActiveSchemaContext } from "../../../src/engine/activeSchemaContext.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import {
  introduceIntent,
  proposeAndCommitOrThrow,
  replayChainStart,
} from "../../support/scenario/scenarioRunner.js";
import { runSerialIntroduceFarm } from "../../support/scenario/scenarioRunner.js";
import { actorRef, contentRef } from "@cantilune/core";
import { runtimeActors } from "../../support/scenario/largeWorld.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";
import { MemoryResourceLockTable } from "../../../src/memory/index.js";

describe("L7 cold-start replay", () => {
  it("replays from T0 + durable wire bundle on a fresh runtime instance", () => {
    const { runtime, durable, store, recipeSidecar, t0, changelog } = buildTestRuntime({
      eventCount: 24,
    });

    runSerialIntroduceFarm(runtime, 5);
    proposeAndCommitOrThrow(runtime, introduceIntent(10));
    runtime.observe(
      {
        source: actorRef(runtimeActors.human, "human"),
        payloadRef: contentRef("content://cold-start-obs"),
      },
      { principal: actorRef(runtimeActors.human, "human") },
    );

    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);
    const serialized = serializeDurableBundle(bundle);
    const imported = deserializeDurableBundle(serialized);
    expect("code" in imported).toBe(false);
    if ("code" in imported) {
      return;
    }

    const locks = new MemoryResourceLockTable();
    const coldRuntime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable: imported.durable,
        clock: createFixedClock(),
        idGen: createDeterministicIdGenerator({
          snapshotRefs: ["snap-unused"],
          changeIds: ["chg-unused"],
        }),
        schema: createDefaultSchema(),
        activeEpochId: imported.t0.epochId,
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks,
      }),
    );

    const replay = coldRuntime.replay({
      fromRef: replayChainStart(imported.changelog, imported.t0),
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }
    expect(replay.steps).toHaveLength(changelog.all().length);
    expect(replay.terminal.artifacts.size).toBe(runtime.getHead()?.artifacts.size);

    const verifier = createReplayVerifier({
      durable: imported.durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const direct = verifier.verify({ fromRef: imported.t0.snapshotRef });
    expect(direct.ok).toBe(true);
  });
});
