import { describe, expect, it, vi } from "vitest";
import {
  activationDomainId,
  bindingGeneration,
  contentDigest,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  operationTypeId,
  operationTemplateRef,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaId,
  schemaRevisionId,
  snapshotRef,
  type SchemaEpochBinding,
} from "@cantilune/core";
import { createReplayVerifier } from "../../../src/execution/replayVerifier.js";
import {
  createDefaultHandlers,
  introduceArtifactHandler,
} from "../../../src/execution/handlers/index.js";
import { InMemoryHandlerRegistry } from "../../../src/execution/handlerRegistry.js";
import { createActiveSchemaContext } from "../../../src/engine/activeSchemaContext.js";
import {
  createDefaultSchema,
  defaultIntroduceTemplate,
} from "../../../src/schema/defaultSchema.js";
import type { OperationTemplate } from "../../../src/schema/operationTemplate.js";
import type { OrchestrationSchema } from "../../../src/schema/orchestrationSchema.js";
import type { RuntimeSchemaResolver } from "../../../src/ports/runtimeSchemaResolver.js";
import { schemaContentDigest } from "../../../src/schema/schemaContentDigest.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { proposeAndCommitOrThrow, introduceIntent } from "../../support/scenario/scenarioRunner.js";

function historicalBinding(
  schema: OrchestrationSchema,
  runtimeHead: SchemaEpochBinding["runtimeHead"],
): SchemaEpochBinding {
  return {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schema.schemaId,
      revisionId: schemaRevisionId("revision-1"),
      digest: schemaContentDigest(schema),
    },
    policyRef: policyRef(policyId("policy"), policyRevisionId("1"), contentDigest("policy-1")),
    handlerManifestRef: handlerManifestRef(
      handlerManifestId("handlers"),
      handlerManifestDigest("handlers-1"),
    ),
    runtimeHead,
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "test",
    activatedAt: "2026-08-13T00:00:00Z",
  };
}

function historicalResolver(
  schema: OrchestrationSchema,
  binding: SchemaEpochBinding,
  overrides: Partial<RuntimeSchemaResolver> = {},
): RuntimeSchemaResolver {
  return {
    async active() {
      return binding;
    },
    async resolveSchema() {
      return schema;
    },
    async resolveByEpoch() {
      return binding;
    },
    ...overrides,
  };
}

function mutableHistoricalSchema(): OrchestrationSchema {
  const base = createDefaultSchema();
  return {
    ...base,
    objectTypes: new Map(
      [...base.objectTypes].map(([id, declaration]) => [
        id,
        { ...declaration, metadata: { ...declaration.metadata } },
      ]),
    ),
    operationTypes: new Map(
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
    ),
    templates: base.templates.map((template) => ({
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
    })),
    resourceRules: base.resourceRules.map((rule) => ({ ...rule })),
  };
}

describe("createReplayVerifier", () => {
  it("returns empty steps when no changes exist", () => {
    const { durable, t0 } = buildTestRuntime();
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.steps).toHaveLength(0);
    expect(result.terminalRef).toBe(t0.snapshotRef);
  });

  it("rejects an unreachable toRef when no changes exist", () => {
    const { durable, t0 } = buildTestRuntime();
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });

    const result = verifier.verify({
      fromRef: t0.snapshotRef,
      toRef: snapshotRef("snap-never"),
      changes: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.code).toBe("replay_mismatch");
  });

  it("reports missing snapshot at fromRef", () => {
    const { durable } = buildTestRuntime();
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({ fromRef: snapshotRef("snap-missing") });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_chain_broken");
  });

  it("reports beforeRef mismatch during replay", () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const changes = durable.changes();
    const broken = [{ ...changes[0]!, beforeRef: snapshotRef("snap-wrong") }];
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({ fromRef: t0.snapshotRef, changes: broken });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_mismatch");
  });

  it("reports template_not_found when handler revision mismatches", () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const baseSchema = createDefaultSchema();
    const INTRODUCE_V2: OperationTemplate = {
      ...defaultIntroduceTemplate(),
      templateRef: operationTemplateRef("introduce_artifact", "2"),
    };
    const handlers = new InMemoryHandlerRegistry();
    handlers.register(operationTypeId("introduce_artifact"), introduceArtifactHandler, "2");
    const verifier = createReplayVerifier({
      durable,
      handlers,
      schemaContext: createActiveSchemaContext(
        { ...baseSchema, templates: [...baseSchema.templates, INTRODUCE_V2] },
        epochId("42"),
      ),
    });
    const result = verifier.verify({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(["template_not_found", "replay_mismatch"]).toContain(result.violation.code);
  });

  it("stops at toRef when specified", () => {
    const { runtime, t0, durable } = buildTestRuntime({
      eventCount: 8,
      snapshotRefs: ["snap-S1", "snap-S2", "snap-S3"],
      changeIds: ["chg-001", "chg-002"],
    });
    const first = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    proposeAndCommitOrThrow(runtime, introduceIntent(1));
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({
      fromRef: t0.snapshotRef,
      toRef: first.after.snapshotRef,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.steps).toHaveLength(1);
    expect(result.terminalRef).toBe(first.after.snapshotRef);
  });

  it("reports terminal mismatch when toRef not reached", () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({
      fromRef: t0.snapshotRef,
      toRef: snapshotRef("snap-never"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_mismatch");
  });

  it("reports recomputed snapshot mismatch with stored copy", () => {
    const { runtime, t0, durable, store } = buildTestRuntime({ eventCount: 8 });
    const committed = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const stored = store.get(committed.after.snapshotRef);
    expect(stored).toBeDefined();
    if (stored === undefined) {
      return;
    }
    store.put({ ...stored, epochId: stored.epochId });
    const tampered = store.get(committed.after.snapshotRef)!;
    store.put({ ...tampered, artifacts: new Map() });
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_mismatch");
  });

  it("reports handler apply failure during replay", () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const failingHandlers = new InMemoryHandlerRegistry();
    failingHandlers.register(operationTypeId("introduce_artifact"), () => ({
      ok: false as const,
      reason: "replay handler failed",
    }));
    const verifier = createReplayVerifier({
      durable,
      handlers: failingHandlers,
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_mismatch");
  });

  it("reports recomputed snapshot integrity failure", () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const tamperedHandlers = new InMemoryHandlerRegistry();
    tamperedHandlers.register(
      operationTypeId("introduce_artifact"),
      (before, recipe, ctx) => {
        const applied = introduceArtifactHandler(before, recipe, ctx);
        if (!applied.ok) {
          return applied;
        }
        const artifact = [...applied.after.artifacts.values()][0]!;
        return {
          ok: true as const,
          after: {
            ...applied.after,
            artifacts: new Map([
              ["wrong-key" as never, { ...artifact, artifactId: artifact.artifactId }],
            ]),
          },
          involved: applied.involved,
          createdSessionRefs: applied.createdSessionRefs,
        };
      },
      "1",
    );
    const verifier = createReplayVerifier({
      durable,
      handlers: tamperedHandlers,
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_mismatch");
  });

  it("reports broken change chain validation", () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    const committed = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const broken = [
      committed.change,
      {
        ...committed.change,
        changeId: "chg-broken" as typeof committed.change.changeId,
        beforeRef: snapshotRef("snap-not-linked"),
        afterRef: snapshotRef("snap-S2"),
      },
    ];
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });
    const result = verifier.verify({ fromRef: t0.snapshotRef, changes: broken });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("replay_chain_broken");
  });

  it("fails closed when historical schema resolution has no epoch binding", async () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
      activationDomainId: activationDomainId("default"),
      schemaResolver: {
        async active() {
          return undefined;
        },
        async resolveSchema() {
          return undefined;
        },
        async resolveByEpoch() {
          return undefined;
        },
      },
    });

    const result = await verifier.verifyResolved({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation.code).toBe("template_not_found");
  });

  it("uses synchronous replay as the resolved fallback when no resolver is configured", async () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    });

    const result = await verifier.verifyResolved({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(true);
  });

  it("fails closed on incomplete resolver wiring and handles missing or empty replay starts", async () => {
    const { durable, t0 } = buildTestRuntime();
    const schema = createDefaultSchema();
    const binding = historicalBinding(schema, t0.snapshotRef);
    const resolver = historicalResolver(schema, binding);

    const missingDomain = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(schema, epochId("42")),
      schemaResolver: resolver,
    });
    expect((await missingDomain.verifyResolved({ fromRef: t0.snapshotRef })).ok).toBe(false);

    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(schema, epochId("42")),
      schemaResolver: resolver,
      activationDomainId: binding.activationDomainId,
    });
    expect(
      (await verifier.verifyResolved({ fromRef: snapshotRef("snap-does-not-exist") })).ok,
    ).toBe(false);
    const empty = await verifier.verifyResolved({ fromRef: t0.snapshotRef });
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.steps).toHaveLength(0);

    const unreachable = await verifier.verifyResolved({
      fromRef: t0.snapshotRef,
      toRef: snapshotRef("snap-never"),
      changes: [],
    });
    expect(unreachable.ok).toBe(false);
    if (!unreachable.ok) expect(unreachable.violation.code).toBe("replay_mismatch");
  });

  it("rejects historical resolver results for a wrong binding, missing content, or wrong schema", async () => {
    const { runtime, durable, t0 } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const schema = createDefaultSchema();
    const binding = historicalBinding(schema, t0.snapshotRef);

    const verifyWith = async (resolver: RuntimeSchemaResolver) => {
      const verifier = createReplayVerifier({
        durable,
        handlers: createDefaultHandlers(),
        schemaContext: createActiveSchemaContext(schema, epochId("42")),
        schemaResolver: resolver,
        activationDomainId: binding.activationDomainId,
      });
      return verifier.verifyResolved({ fromRef: t0.snapshotRef });
    };

    const wrongDomain = {
      ...binding,
      activationDomainId: activationDomainId("other"),
    };
    expect(
      (
        await verifyWith(
          historicalResolver(schema, binding, {
            async resolveByEpoch() {
              return wrongDomain;
            },
          }),
        )
      ).ok,
    ).toBe(false);

    const wrongEpoch = { ...binding, epochId: epochId("99") };
    expect(
      (
        await verifyWith(
          historicalResolver(schema, binding, {
            async resolveByEpoch() {
              return wrongEpoch;
            },
          }),
        )
      ).ok,
    ).toBe(false);

    expect(
      (
        await verifyWith(
          historicalResolver(schema, binding, {
            async resolveSchema() {
              return undefined;
            },
          }),
        )
      ).ok,
    ).toBe(false);

    const wrongSchema = { ...schema, schemaId: schemaId("wrong-schema") };
    expect(
      (
        await verifyWith(
          historicalResolver(schema, binding, {
            async resolveSchema() {
              return wrongSchema;
            },
          }),
        )
      ).ok,
    ).toBe(false);

    const wrongContent = { ...schema, templates: [] };
    const wrongContentResult = await verifyWith(
      historicalResolver(schema, binding, {
        async resolveSchema() {
          return wrongContent;
        },
      }),
    );
    expect(wrongContentResult.ok).toBe(false);
    if (!wrongContentResult.ok) expect(wrongContentResult.violation.code).toBe("replay_mismatch");

    expect(
      (
        await verifyWith(
          historicalResolver(schema, binding, {
            async resolveByEpoch() {
              throw new Error("resolver unavailable");
            },
          }),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await verifyWith(
          historicalResolver(schema, binding, {
            async resolveByEpoch() {
              throw "resolver unavailable";
            },
          }),
        )
      ).ok,
    ).toBe(false);
  });

  it("caches one historical schema per epoch and honors a resolved toRef boundary", async () => {
    const { runtime, durable, t0 } = buildTestRuntime({
      eventCount: 8,
      snapshotRefs: ["snap-S1", "snap-S2", "snap-S3"],
      changeIds: ["chg-001", "chg-002"],
    });
    const first = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    proposeAndCommitOrThrow(runtime, introduceIntent(1));
    const schema = createDefaultSchema();
    const binding = historicalBinding(schema, t0.snapshotRef);
    const resolveByEpoch = vi.fn(async () => binding);
    const resolveSchema = vi.fn(async () => schema);
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(schema, epochId("42")),
      schemaResolver: historicalResolver(schema, binding, { resolveByEpoch, resolveSchema }),
      activationDomainId: binding.activationDomainId,
    });

    const complete = await verifier.verifyResolved({ fromRef: t0.snapshotRef });
    expect(complete.ok).toBe(true);
    if (complete.ok) expect(complete.steps).toHaveLength(2);
    expect(resolveByEpoch).toHaveBeenCalledTimes(1);
    expect(resolveSchema).toHaveBeenCalledTimes(1);

    const bounded = await verifier.verifyResolved({
      fromRef: t0.snapshotRef,
      toRef: first.after.snapshotRef,
    });
    expect(bounded.ok).toBe(true);
    if (bounded.ok) expect(bounded.steps).toHaveLength(1);
  });

  it("pins the first resolved schema snapshot across later changes in the same epoch", async () => {
    const { runtime, durable, t0 } = buildTestRuntime({
      eventCount: 8,
      snapshotRefs: ["snap-S1", "snap-S2", "snap-S3"],
      changeIds: ["chg-001", "chg-002"],
    });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    proposeAndCommitOrThrow(runtime, introduceIntent(1));

    const schema = mutableHistoricalSchema();
    const binding = historicalBinding(schema, t0.snapshotRef);
    const introduce = schema.templates.find(
      (template) => template.operationTypeId === "introduce_artifact",
    );
    if (introduce === undefined) throw new Error("fixture requires introduce_artifact");

    let applications = 0;
    const handlers = new InMemoryHandlerRegistry();
    handlers.register(
      operationTypeId("introduce_artifact"),
      (before, recipe, context) => {
        const applied = introduceArtifactHandler(before, recipe, context);
        applications += 1;
        if (applications === 1) {
          // The resolver still owns this object. Poison its Map, array, nested
          // template ref, and condition after the first replay application.
          (schema.operationTypes as unknown as Map<unknown, unknown>).clear();
          (schema.templates as OperationTemplate[]).splice(0);
          (introduce.templateRef as { revision: string }).revision = "caller-mutated";
          (introduce.requires[0]!.bindings as Record<string, string>).participant = "task";
        }
        return applied;
      },
      "1",
    );

    const resolveSchema = vi.fn(async () => schema);
    const verifier = createReplayVerifier({
      durable,
      handlers,
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
      schemaResolver: historicalResolver(schema, binding, { resolveSchema }),
      activationDomainId: binding.activationDomainId,
    });

    const result = await verifier.verifyResolved({ fromRef: t0.snapshotRef });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.steps).toHaveLength(2);
    expect(applications).toBe(2);
    expect(resolveSchema).toHaveBeenCalledTimes(1);

    // A new invocation re-resolves the binding identity, but must reuse the
    // verifier's authoritative detached context rather than snapshotting the
    // now-poisoned caller-owned schema again.
    const repeated = await verifier.verifyResolved({ fromRef: t0.snapshotRef });
    expect(repeated.ok).toBe(true);
    if (repeated.ok) expect(repeated.steps).toHaveLength(2);
    expect(applications).toBe(4);
    expect(resolveSchema).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an epoch cache entry for a different binding identity", async () => {
    const { runtime, durable, t0 } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const schema = mutableHistoricalSchema();
    const firstBinding = historicalBinding(schema, t0.snapshotRef);
    let currentBinding = firstBinding;
    let currentSchema = schema;
    const resolveByEpoch = vi.fn(async () => currentBinding);
    const resolveSchema = vi.fn(async () => currentSchema);
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
      schemaResolver: historicalResolver(schema, firstBinding, {
        resolveByEpoch,
        resolveSchema,
      }),
      activationDomainId: firstBinding.activationDomainId,
    });

    expect((await verifier.verifyResolved({ fromRef: t0.snapshotRef })).ok).toBe(true);

    currentSchema = { ...schema, templates: [] };
    currentBinding = {
      ...firstBinding,
      schemaRef: {
        ...firstBinding.schemaRef,
        revisionId: schemaRevisionId("revision-2"),
        digest: schemaContentDigest(currentSchema),
      },
    };

    const rebound = await verifier.verifyResolved({ fromRef: t0.snapshotRef });
    expect(rebound.ok).toBe(false);
    if (!rebound.ok) expect(rebound.violation.code).toBe("template_not_found");
    expect(resolveByEpoch).toHaveBeenCalledTimes(2);
    expect(resolveSchema).toHaveBeenCalledTimes(2);
  });

  it("reports resolved replay chain, bridge, recipe, and terminal boundary failures", async () => {
    const { runtime, durable, t0 } = buildTestRuntime({ eventCount: 8 });
    const committed = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const schema = createDefaultSchema();
    const binding = historicalBinding(schema, t0.snapshotRef);
    const verifier = createReplayVerifier({
      durable,
      handlers: createDefaultHandlers(),
      schemaContext: createActiveSchemaContext(schema, epochId("42")),
      schemaResolver: historicalResolver(schema, binding),
      activationDomainId: binding.activationDomainId,
    });

    const brokenChain = [
      committed.change,
      {
        ...committed.change,
        changeId: "chg-broken-resolved" as typeof committed.change.changeId,
        beforeRef: snapshotRef("snap-not-linked"),
        afterRef: snapshotRef("snap-S2"),
      },
    ];
    expect(
      (await verifier.verifyResolved({ fromRef: t0.snapshotRef, changes: brokenChain })).ok,
    ).toBe(false);

    const brokenBridge = [{ ...committed.change, beforeRef: snapshotRef("snap-not-linked") }];
    expect(
      (await verifier.verifyResolved({ fromRef: t0.snapshotRef, changes: brokenBridge })).ok,
    ).toBe(false);

    const recipeSpy = vi.spyOn(durable, "recipeForChange").mockReturnValue(undefined as never);
    expect((await verifier.verifyResolved({ fromRef: t0.snapshotRef })).ok).toBe(false);
    recipeSpy.mockRestore();

    expect(
      (
        await verifier.verifyResolved({
          fromRef: t0.snapshotRef,
          toRef: snapshotRef("snap-never"),
        })
      ).ok,
    ).toBe(false);
  });
});
