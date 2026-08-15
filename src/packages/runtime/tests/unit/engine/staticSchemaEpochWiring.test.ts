import { describe, expect, it } from "vitest";
import { collaborationSnapshot, epochId, participant, actorId, snapshotRef } from "@cantilune/core";
import type { CollaborationSnapshot } from "@cantilune/core";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import {
  runtimeDependenciesWithStaticSchema,
  UNSEEDED_EPOCH_ID,
} from "../../../src/engine/runtimeDependenciesCompat.js";
import { resolveActiveSchemaContext } from "../../../src/engine/schemaContextProvider.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { createMemoryRuntimePersistence } from "../../../src/memory/memoryDurableCoordinator.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import type { OperationTemplate } from "../../../src/schema/operationTemplate.js";
import type {
  ObjectTypeDeclaration,
  OperationTypeDeclaration,
  OrchestrationSchema,
  ResourceRule,
} from "../../../src/schema/orchestrationSchema.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { introduceIntent } from "../../support/scenario/scenarioRunner.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";

const AGENT = actorId("wiring-agent");

/** A world seeded at an arbitrary epoch, as a resumed file-backed world would be. */
function worldAt(epoch: string): CollaborationSnapshot {
  return collaborationSnapshot({
    snapshotRef: snapshotRef("snap-0"),
    epochId: epochId(epoch),
    participants: new Map([[AGENT, participant(AGENT, "agent")]]),
  });
}

function deps(
  durable: ReturnType<typeof createMemoryRuntimePersistence>["durable"],
  activeEpochId = epochId("static-schema-v1"),
  compatibleEpochIds: readonly ReturnType<typeof epochId>[] = [],
) {
  return runtimeDependenciesWithStaticSchema({
    durable,
    clock: createFixedClock(),
    idGen: createDeterministicIdGenerator(),
    schema: createDefaultSchema(),
    activeEpochId,
    compatibleEpochIds,
    policy: allowAllPolicyEvaluator(),
    handlers: createDefaultHandlers(),
    locks: new MemoryResourceLockTable(),
    ...(activeEpochId !== undefined ? { activeEpochId } : {}),
  });
}

function mutableSchemaFixture(): OrchestrationSchema {
  const base = createDefaultSchema();
  const templates = base.templates.map((template) => ({
    ...template,
    templateRef: { ...template.templateRef },
    requiredRoles: [...template.requiredRoles],
    requires: template.requires.map((condition) => ({
      ...condition,
      bindings: { ...condition.bindings },
    })),
    ensures: template.ensures.map((condition) => ({
      ...condition,
      bindings: { ...condition.bindings },
    })),
  }));
  const objectTypes = new Map(
    [...base.objectTypes].map(([id, declaration]) => [
      id,
      { ...declaration, metadata: { ...declaration.metadata } },
    ]),
  );
  const operationTypes = new Map(
    [...base.operationTypes].map(([id, declaration]) => [
      id,
      {
        ...declaration,
        templateRef: { ...declaration.templateRef },
        requiredRoles: [...declaration.requiredRoles],
        portContract: {
          inputs: declaration.portContract.inputs.map((port) => ({ ...port })),
          outputs: declaration.portContract.outputs.map((port) => ({ ...port })),
          requires: declaration.portContract.requires.map((condition) => ({
            ...condition,
            bindings: { ...condition.bindings },
          })),
          ensures: declaration.portContract.ensures.map((condition) => ({
            ...condition,
            bindings: { ...condition.bindings },
          })),
        },
      },
    ]),
  );
  const firstObjectType = [...objectTypes.keys()][0];
  if (firstObjectType === undefined) throw new Error("fixture requires an object type");

  return {
    ...base,
    objectTypes,
    operationTypes,
    templates,
    resourceRules: [
      {
        ruleId: "immutable-rule",
        objectTypeId: firstObjectType,
        structuralMode: "linear",
        capacity: 1,
        allowsCopy: false,
        allowsDrop: false,
        requiresQuiescence: true,
      },
    ],
  };
}

/**
 * The active epoch used to be pinned to a magic constant at construction when
 * the caller omitted it. Any world not sitting on that exact constant then had
 * every coordination operation rejected as `epoch_mismatch`, while content
 * reads and writes kept working — a live process with a dead coordination
 * plane. These tests pin the wiring rather than the symptom.
 */
describe("static schema epoch wiring", () => {
  it("refuses to infer schema identity from an arbitrary durable epoch", () => {
    for (const epoch of ["boot-epoch-1", "42", "epoch-from-an-older-build"]) {
      const { durable } = createMemoryRuntimePersistence({ initial: worldAt(epoch) });
      expect(() => deps(durable)).toThrow(/not bound to head snapshot epoch/);
    }
  });

  it("accepts a world seeded later only at the explicitly bound epoch", () => {
    const { durable, store } = createMemoryRuntimePersistence();
    const wired = deps(durable, epochId("seeded-later"));
    expect(resolveActiveSchemaContext(wired).epochId).toBe(epochId("seeded-later"));

    // Construction-time capture could not see this snapshot; a per-call read can.
    const seeded = worldAt("seeded-later");
    store.put(seeded);
    durable.compareAndSwapHead(seeded.snapshotRef, seeded);

    expect(resolveActiveSchemaContext(wired).epochId).toBe(epochId("seeded-later"));
  });

  it("refuses a later seed at an undeclared epoch", () => {
    const { durable, store } = createMemoryRuntimePersistence();
    const wired = deps(durable, UNSEEDED_EPOCH_ID);
    const seeded = worldAt("unexpected");
    store.put(seeded);
    durable.compareAndSwapHead(seeded.snapshotRef, seeded);

    expect(() => resolveActiveSchemaContext(wired)).toThrow(/not bound to head snapshot epoch/);
  });

  it("throws at construction when a pinned epoch disagrees with the head", () => {
    const { durable } = createMemoryRuntimePersistence({ initial: worldAt("head-epoch") });
    expect(() => deps(durable, epochId("pinned-epoch"))).toThrow(
      /not bound to head snapshot epoch/,
    );
  });

  it("accepts a pinned epoch that agrees with the head", () => {
    const { durable } = createMemoryRuntimePersistence({ initial: worldAt("agreed") });
    expect(resolveActiveSchemaContext(deps(durable, epochId("agreed"))).epochId).toBe(
      epochId("agreed"),
    );
  });

  it("accepts only caller-declared compatible legacy aliases", () => {
    const legacy = epochId("boot-epoch-legacy");
    const { durable } = createMemoryRuntimePersistence({ initial: worldAt(legacy) });
    const context = resolveActiveSchemaContext(deps(durable, epochId("boot-epoch-1"), [legacy]));
    expect(context.epochId).toBe(legacy);
  });

  it("refuses epoch transitions, which belong to the governed wiring", () => {
    const { durable } = createMemoryRuntimePersistence({ initial: worldAt("static") });
    const holder = deps(durable, epochId("static")).schemaContext as { set: (ctx: never) => void };
    expect(() => holder.set(undefined as never)).toThrow(/does not support epoch transitions/);
  });

  it("admits an operation against a world on a non-default epoch", () => {
    const { durable } = createMemoryRuntimePersistence({ initial: worldAt("boot-epoch-1") });
    const runtime = createCoordinationRuntime(deps(durable, epochId("boot-epoch-1")));
    const head = runtime.getHead();
    expect(head?.epochId).toBe(epochId("boot-epoch-1"));
  });

  it("pins a detached schema at wiring time and exposes no mutable authority", () => {
    const { durable } = createMemoryRuntimePersistence({ initial: worldAt("immutable") });
    const schema = mutableSchemaFixture();
    const wired = runtimeDependenciesWithStaticSchema({
      durable,
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator(),
      schema,
      activeEpochId: epochId("immutable"),
      policy: allowAllPolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks: new MemoryResourceLockTable(),
      contentRefAuthority: { isAvailable: () => true },
    });

    const introduce = schema.templates.find(
      (template) => template.operationTypeId === "introduce_artifact",
    );
    const objectType = [...schema.objectTypes.values()][0];
    const rule = schema.resourceRules[0];
    if (introduce === undefined || objectType === undefined || rule === undefined) {
      throw new Error("incomplete immutability fixture");
    }

    // Mutate every caller-owned container after wiring but before holder.get().
    (schema.operationTypes as unknown as Map<string, OperationTypeDeclaration>).delete(
      introduce.operationTypeId,
    );
    (schema.objectTypes as unknown as Map<string, ObjectTypeDeclaration>).clear();
    (schema.templates as OperationTemplate[]).splice(1);
    (introduce.requiredRoles as string[]).splice(0);
    (introduce.requires[0]!.bindings as Record<string, string>).participant = "task";
    (objectType.metadata as Record<string, string>).drift = "caller-owned";
    (rule as { capacity: number }).capacity = 0;
    (schema.resourceRules as ResourceRule[]).push({ ...rule, ruleId: "late-rule" });

    const context = resolveActiveSchemaContext(wired);
    const pinnedTemplate = context.getTemplate(introduce.operationTypeId);
    const pinnedObjectType = [...context.schema.objectTypes.values()][0];
    expect(context.allowedOperations.has(introduce.operationTypeId)).toBe(true);
    expect(pinnedTemplate?.requiredRoles).toEqual(["task", "from"]);
    expect(pinnedTemplate?.requires[0]?.bindings).toEqual({ participant: "from" });
    expect(pinnedObjectType?.metadata).toEqual({});
    expect(context.schema.resourceRules).toHaveLength(1);
    expect(context.schema.resourceRules[0]?.capacity).toBe(1);

    // Readonly TypeScript types must also be immutable at runtime after casts.
    expect(() => (context.schema.operationTypes as Map<unknown, unknown>).clear()).toThrow();
    expect(() => (context.allowedOperations as Set<unknown>).add("late")).toThrow();
    expect(() => (context.schema.templates as OperationTemplate[]).push(introduce)).toThrow();
    expect(() => {
      (pinnedTemplate!.requires[0]!.bindings as Record<string, string>).participant = "task";
    }).toThrow();

    // Admission still uses the pinned declarations, not the mutated source.
    const result = createCoordinationRuntime(wired).proposeAndCommit(introduceIntent(0, AGENT));
    expect("change" in result).toBe(true);
  });
});
