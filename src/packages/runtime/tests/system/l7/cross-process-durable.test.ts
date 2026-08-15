import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { createFileRuntimePersistence } from "../../../src/memory/fileDurablePersistence.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { buildRuntimeLargeWorld } from "../../support/scenario/largeWorld.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";
import {
  introduceIntent,
  proposeAndCommitOrThrow,
  replayChainStart,
} from "../../support/scenario/scenarioRunner.js";

function fileRuntime(
  dir: string,
  eventCount: number,
  idOffset: number,
  initial = buildRuntimeLargeWorld(4),
) {
  const persistence = createFileRuntimePersistence({ dir, initial });
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable: persistence.durable,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({
        snapshotRefs: Array.from({ length: eventCount }, (_, i) => `snap-F${idOffset + i}`),
        changeIds: Array.from({ length: eventCount }, (_, i) => `chg-F${idOffset + i}`),
        sessionIds: Array.from({ length: eventCount }, (_, i) => `session-F${idOffset + i}`),
        linkIds: [`link-F${idOffset}`],
      }),
      schema: createDefaultSchema(),
      activeEpochId: initial.epochId,
      policy: allowAllPolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks: persistence.locks,
      contentRefAuthority: { isAvailable: () => true },
    }),
  );
  return { runtime, persistence };
}

describe("L7 cross-process file durable", () => {
  it("survives new coordinator instance on same bundle directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-file-durable-"));
    try {
      const world = buildRuntimeLargeWorld(4);
      const first = fileRuntime(dir, 8, 0, world);
      proposeAndCommitOrThrow(first.runtime, introduceIntent(0));
      proposeAndCommitOrThrow(first.runtime, introduceIntent(1));

      const second = fileRuntime(dir, 8, 2, world);
      expect(second.persistence.durable.head()).toEqual(first.runtime.getHead()?.snapshotRef);

      proposeAndCommitOrThrow(second.runtime, introduceIntent(2));

      const third = fileRuntime(dir, 8, 3, world);
      const replay = third.runtime.replay({
        fromRef: replayChainStart(third.persistence.changelog, world),
      });
      expect(replay.ok).toBe(true);
      if (replay.ok) {
        expect(replay.terminal.artifacts.size).toBe(3);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
