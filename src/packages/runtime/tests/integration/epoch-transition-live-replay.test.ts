import { describe, expect, it } from "vitest";
import {
  activationDomainId,
  bindingGeneration,
  collaborationSnapshot,
  contentDigest,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaRevisionId,
  type SchemaEpochBinding,
  type SchemaRef,
} from "@cantilune/core";
import {
  AdmissionRegistry,
  buildOrchestrationSchema,
  createActiveSchemaContext,
  createCoordinationRuntime,
  createDefaultHandlers,
  createMemoryEpochAdministration,
  createMutableBindingHolder,
  createMutableSchemaContextHolder,
  defaultDelegateTemplate,
  defaultIntroduceTemplate,
  templateAwarePolicyEvaluator,
  schemaContentDigest,
  type OrchestrationSchema,
  type RuntimeSchemaResolver,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence } from "../../src/memory/memoryDurableCoordinator.js";
import { MemoryResourceLockTable } from "../../src/memory/memoryLockTable.js";
import { buildConfigT0, storyActorIds } from "@cantilune/test-fixtures";
import { createDeterministicIdGenerator } from "../support/deterministicIds.js";
import { createFixedClock } from "../support/fixedClock.js";
import {
  delegateIntent,
  introduceIntent,
  proposeAndCommitOrThrow,
} from "../support/scenario/scenarioRunner.js";

function schemaKey(ref: SchemaRef): string {
  return `${ref.schemaId}@${ref.revisionId}@${ref.digest}`;
}

function bindingFor(
  schema: OrchestrationSchema,
  options: {
    readonly epoch: string;
    readonly ordinal: number;
    readonly generation: number;
    readonly revision: string;
    readonly runtimeHead: SchemaEpochBinding["runtimeHead"];
    readonly admission: string;
  },
): SchemaEpochBinding {
  return {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(options.generation),
    epochId: epochId(options.epoch),
    epochOrdinal: epochOrdinal(options.ordinal),
    schemaRef: {
      schemaId: schema.schemaId,
      revisionId: schemaRevisionId(options.revision),
      digest: schemaContentDigest(schema),
    },
    policyRef: policyRef(policyId("policy"), policyRevisionId("1"), contentDigest("policy-1")),
    handlerManifestRef: handlerManifestRef(
      handlerManifestId("handlers"),
      handlerManifestDigest("handlers-1"),
    ),
    runtimeHead: options.runtimeHead,
    admissionId: schemaAdmissionId(options.admission),
    activatedBy: "test",
    activatedAt: "2026-08-13T00:00:00Z",
  };
}

describe("live epoch transition chain and historical replay", () => {
  it("commits after a strict epoch-only head advance and replays with per-epoch schemas", async () => {
    const t0 = collaborationSnapshot({
      ...buildConfigT0(),
      heartbeatLog: [
        {
          agentId: storyActorIds.planner,
          sequenceNo: 1,
          emittedAt: "2026-08-13T00:00:00Z",
          turnCount: 7,
          lastAction: "write_content",
        },
      ],
    });
    const oldSchema = buildOrchestrationSchema("epoch-old", [defaultIntroduceTemplate()]);
    const newSchema = buildOrchestrationSchema("epoch-new", [defaultDelegateTemplate()]);
    const oldBinding = bindingFor(oldSchema, {
      epoch: "42",
      ordinal: 1,
      generation: 1,
      revision: "old",
      runtimeHead: t0.snapshotRef,
      admission: "bootstrap",
    });
    const newSchemaRef: SchemaRef = {
      schemaId: newSchema.schemaId,
      revisionId: schemaRevisionId("new"),
      digest: schemaContentDigest(newSchema),
    };

    const { durable } = createMemoryRuntimePersistence({ initial: t0 });
    const locks = new MemoryResourceLockTable();
    const registry = new AdmissionRegistry(locks);
    const schemaHolder = createMutableSchemaContextHolder(
      createActiveSchemaContext(oldSchema, oldBinding.epochId, oldBinding),
    );
    const bindingHolder = createMutableBindingHolder(oldBinding);
    const schemas = new Map<string, OrchestrationSchema>([
      [schemaKey(oldBinding.schemaRef), oldSchema],
      [schemaKey(newSchemaRef), newSchema],
    ]);
    const bindingsByEpoch = new Map([[oldBinding.epochId, oldBinding]]);
    const resolvedEpochs: string[] = [];
    const schemaResolver: RuntimeSchemaResolver = {
      async active(domainId) {
        return domainId === oldBinding.activationDomainId ? bindingHolder.get() : undefined;
      },
      async resolveSchema(ref) {
        return schemas.get(schemaKey(ref));
      },
      async resolveByEpoch(domainId, targetEpochId) {
        if (domainId !== oldBinding.activationDomainId) return undefined;
        resolvedEpochs.push(targetEpochId);
        return bindingsByEpoch.get(targetEpochId);
      },
    };
    const businessIds = createDeterministicIdGenerator({
      snapshotRefs: ["snap-B1", "snap-B2"],
      changeIds: ["chg-B1", "chg-B2"],
      sessionIds: ["session-B2"],
    });
    const runtime = createCoordinationRuntime({
      durable,
      locks,
      registry,
      clock: createFixedClock(),
      idGen: businessIds,
      schemaContext: schemaHolder,
      schemaResolver,
      activationDomainId: oldBinding.activationDomainId,
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      contentRefAuthority: { isAvailable: () => true },
    });

    const first = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const epochAdmin = createMemoryEpochAdministration({
      durable,
      registry,
      locks,
      schemaHolder,
      bindingHolder,
      domainId: oldBinding.activationDomainId,
      idGen: createDeterministicIdGenerator({ snapshotRefs: ["snap-E1"] }),
      resolveSchema: (ref) => schemas.get(schemaKey(ref)),
    });
    const prepared = await epochAdmin.prepareEpochTransition({
      admissionId: schemaAdmissionId("epoch-switch"),
      domainId: oldBinding.activationDomainId,
      expectedBindingGeneration: oldBinding.bindingGeneration,
      expectedHead: first.after.snapshotRef,
      expectedEpochId: oldBinding.epochId,
      expectedEpochOrdinal: oldBinding.epochOrdinal,
      targetSchemaRef: newSchemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "epoch-switch-plan",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const transition = await epochAdmin.commitEpochTransition(prepared.value);
    expect(transition.ok).toBe(true);
    if (!transition.ok) return;
    expect(durable.get(transition.value.afterSnapshotRef)?.heartbeatLog).toEqual(t0.heartbeatLog);
    bindingsByEpoch.set(transition.value.toBinding.epochId, transition.value.toBinding);

    const second = proposeAndCommitOrThrow(
      runtime,
      delegateIntent(0, storyActorIds.planner, storyActorIds.coder),
    );
    expect(second.change.beforeRef).toBe(transition.value.afterSnapshotRef);
    expect(second.after.heartbeatLog).toEqual(t0.heartbeatLog);
    expect(durable.changes()).toHaveLength(2);

    // A single active context cannot represent the old epoch and now fails
    // closed. The resolver-backed path selects each historical binding.
    expect(runtime.replay({ fromRef: t0.snapshotRef }).ok).toBe(false);
    const replay = await runtime.replayResolved({ fromRef: t0.snapshotRef });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.steps).toHaveLength(2);
    expect(replay.terminalRef).toBe(second.after.snapshotRef);
    expect(replay.terminal.heartbeatLog).toEqual(t0.heartbeatLog);
    expect(new Set(resolvedEpochs)).toEqual(new Set(["42", "43"]));
  });
});
