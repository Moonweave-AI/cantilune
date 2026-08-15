import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  activationDomainId,
  actorRef,
  bindingGeneration,
  contentDigest,
  coordinationIntent,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  matchBinding,
  operationTypeId,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaRevisionId,
  type CollaborationSnapshot,
  type SchemaEpochBinding,
} from "@cantilune/core";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { createActiveSchemaContext } from "../../../src/engine/activeSchemaContext.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createReplayVerifier } from "../../../src/execution/replayVerifier.js";
import { InMemoryHandlerRegistry } from "../../../src/execution/handlerRegistry.js";
import {
  createDefaultHandlers,
  emitHeartbeatHandler,
} from "../../../src/execution/handlers/index.js";
import { createFileRuntimePersistence } from "../../../src/memory/fileDurablePersistence.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";
import {
  createStaticSchemaResolver,
  schemaLookupKey,
} from "../../../src/ports/runtimeSchemaResolver.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { schemaContentDigest } from "../../../src/schema/schemaContentDigest.js";
import type { OrchestrationSchema } from "../../../src/schema/orchestrationSchema.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";
import { proposeAndCommitOrThrow } from "../../support/scenario/scenarioRunner.js";

const EMITTED_AT = "2026-08-13T09:00:00Z";

function heartbeatIntent() {
  return coordinationIntent(
    actorRef(storyActorIds.planner, "agent"),
    operationTypeId("emit_heartbeat"),
    [matchBinding("from", storyActorIds.planner)],
    undefined,
    undefined,
    { turnCount: 37, lastAction: "write_content" },
  );
}

function bindingFor(schema: OrchestrationSchema, t0: CollaborationSnapshot): SchemaEpochBinding {
  return {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: t0.epochId,
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schema.schemaId,
      revisionId: schemaRevisionId("heartbeat-replay-v1"),
      digest: schemaContentDigest(schema),
    },
    policyRef: policyRef(policyId("policy"), policyRevisionId("1"), contentDigest("policy-1")),
    handlerManifestRef: handlerManifestRef(
      handlerManifestId("handlers"),
      handlerManifestDigest("handlers-1"),
    ),
    runtimeHead: t0.snapshotRef,
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "test",
    activatedAt: EMITTED_AT,
  };
}

function createFileRuntime(dir: string, initial?: CollaborationSnapshot) {
  const persistence = createFileRuntimePersistence({
    dir,
    ...(initial !== undefined ? { initial } : {}),
  });
  const head = persistence.durable.head();
  const world = head === undefined ? undefined : persistence.durable.get(head);
  if (world === undefined) throw new Error("file runtime has no readable head");
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable: persistence.durable,
      clock: createFixedClock(EMITTED_AT),
      idGen: createDeterministicIdGenerator({
        snapshotRefs: ["snap-heartbeat-after"],
        changeIds: ["chg-heartbeat"],
      }),
      schema: createDefaultSchema(),
      activeEpochId: world.epochId,
      policy: allowAllPolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks: persistence.locks,
      contentRefAuthority: { isAvailable: () => true },
    }),
  );
  return { persistence, runtime };
}

describe("L7 heartbeat replay determinism", () => {
  it("reuses one commit-time instant after a real delay during synchronous replay", async () => {
    const { runtime, durable, t0 } = buildTestRuntime();
    const committed = proposeAndCommitOrThrow(runtime, heartbeatIntent());

    expect(committed.change.recordedAt).toBe("2026-08-07T10:00:00Z");
    expect(committed.after.heartbeatLog.at(-1)?.emittedAt).toBe("2026-08-07T10:00:00Z");
    expect(committed.after.heartbeatLog.at(-1)?.turnCount).toBe(37);
    expect(committed.after.heartbeatLog.at(-1)?.lastAction).toBe("write_content");
    expect(durable.recipeForChange(committed.change)?.emittedAt).toBe("2026-08-07T10:00:00Z");

    await new Promise<void>((resolve) => setTimeout(resolve, 15));

    const replayed = runtime.replay({
      fromRef: t0.snapshotRef,
      toRef: committed.after.snapshotRef,
    });
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(replayed.terminal.heartbeatLog.at(-1)?.emittedAt).toBe("2026-08-07T10:00:00Z");
      expect(replayed.terminal.heartbeatLog.at(-1)?.turnCount).toBe(37);
      expect(replayed.terminal.heartbeatLog.at(-1)?.lastAction).toBe("write_content");
    }
  });

  it("uses the persisted heartbeat instant through resolved historical replay", async () => {
    const { runtime, durable, t0 } = buildTestRuntime();
    const committed = proposeAndCommitOrThrow(runtime, heartbeatIntent());
    const schema = createDefaultSchema();
    const binding = bindingFor(schema, t0);
    const resolver = createStaticSchemaResolver({
      domainId: binding.activationDomainId,
      binding,
      schemas: new Map([[schemaLookupKey(binding.schemaRef), schema]]),
    });
    const resolvedRuntime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable,
        clock: createFixedClock("2099-01-01T00:00:00Z"),
        idGen: createDeterministicIdGenerator(),
        schema,
        activeEpochId: t0.epochId,
        schemaResolver: resolver,
        activationDomainId: binding.activationDomainId,
        policy: allowAllPolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
        contentRefAuthority: { isAvailable: () => true },
      }),
    );

    const replayed = await resolvedRuntime.replayResolved({
      fromRef: t0.snapshotRef,
      toRef: committed.after.snapshotRef,
    });
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(replayed.terminal.heartbeatLog.at(-1)?.emittedAt).toBe("2026-08-07T10:00:00Z");
      expect(replayed.terminal.heartbeatLog.at(-1)?.turnCount).toBe(37);
      expect(replayed.terminal.heartbeatLog.at(-1)?.lastAction).toBe("write_content");
    }
  });

  it("keeps handlers and replay isolated from returned change and recipe mutation attempts", () => {
    const { runtime, durable, t0 } = buildTestRuntime();
    const committed = proposeAndCommitOrThrow(runtime, heartbeatIntent());
    const terminalRef = committed.after.snapshotRef;

    // Commit results are caller-owned. Rewriting them after the commit must not
    // rewrite the change or recipe already accepted as replay authority.
    (committed.change as unknown as { afterRef: string }).afterRef = "snap-poisoned";
    (committed.change.matchBindings[0] as unknown as { actorId: string }).actorId =
      "agent-poisoned";

    const returnedChange = durable.changes()[0]!;
    const returnedRecipe = durable.recipeForChange(returnedChange)!;
    expect(Object.isFrozen(returnedChange)).toBe(true);
    expect(Object.isFrozen(returnedChange.matchBindings[0])).toBe(true);
    expect(Object.isFrozen(returnedRecipe)).toBe(true);
    expect(Object.isFrozen(returnedRecipe.scalarInputs)).toBe(true);
    expect(() => {
      (returnedChange as unknown as { afterRef: string }).afterRef = "snap-poisoned";
    }).toThrow(TypeError);
    expect(() => {
      (returnedRecipe.scalarInputs as Record<string, string | number | boolean>).turnCount = 999;
    }).toThrow(TypeError);

    let handlerSawFrozenAuthority = false;
    let handlerMutationRejected = false;
    const handlers = new InMemoryHandlerRegistry();
    handlers.register(
      operationTypeId("emit_heartbeat"),
      (before, recipe, context) => {
        handlerSawFrozenAuthority =
          Object.isFrozen(recipe) &&
          Object.isFrozen(recipe.matchBindings) &&
          Object.isFrozen(recipe.scalarInputs);
        try {
          (recipe.scalarInputs as Record<string, string | number | boolean>).turnCount = 999;
        } catch (error) {
          handlerMutationRejected = error instanceof TypeError;
        }
        return emitHeartbeatHandler(before, recipe, context);
      },
      "1",
    );
    const verifier = createReplayVerifier({
      durable,
      handlers,
      schemaContext: createActiveSchemaContext(createDefaultSchema(), t0.epochId),
    });

    const replayed = verifier.verify({ fromRef: t0.snapshotRef, toRef: terminalRef });
    expect(replayed.ok).toBe(true);
    expect(handlerSawFrozenAuthority).toBe(true);
    expect(handlerMutationRejected).toBe(true);
    if (replayed.ok) {
      expect(replayed.terminal.heartbeatLog.at(-1)).toMatchObject({
        agentId: storyActorIds.planner,
        emittedAt: "2026-08-07T10:00:00Z",
        turnCount: 37,
        lastAction: "write_content",
      });
    }
    expect(durable.changes()[0]).toMatchObject({
      afterRef: terminalRef,
      matchBindings: [{ role: "from", actorId: storyActorIds.planner }],
    });
    expect(durable.recipeForChange(durable.changes()[0]!)?.scalarInputs).toEqual({
      turnCount: 37,
      lastAction: "write_content",
    });
  });

  it("restores heartbeat replay authority from file durable storage after restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-heartbeat-replay-"));
    try {
      const t0 = buildConfigT0();
      const first = createFileRuntime(dir, t0);
      const committed = proposeAndCommitOrThrow(first.runtime, heartbeatIntent());

      const restarted = createFileRuntime(dir);
      expect(restarted.persistence.durable.recipeForChange(committed.change)?.emittedAt).toBe(
        EMITTED_AT,
      );
      expect(restarted.persistence.durable.recipeForChange(committed.change)?.scalarInputs).toEqual(
        { turnCount: 37, lastAction: "write_content" },
      );
      const replayed = restarted.runtime.replay({
        fromRef: t0.snapshotRef,
        toRef: committed.after.snapshotRef,
      });
      expect(replayed.ok).toBe(true);
      if (replayed.ok) {
        expect(replayed.terminal.heartbeatLog.at(-1)?.emittedAt).toBe(EMITTED_AT);
        expect(replayed.terminal.heartbeatLog.at(-1)?.turnCount).toBe(37);
        expect(replayed.terminal.heartbeatLog.at(-1)?.lastAction).toBe("write_content");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
