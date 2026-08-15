import { describe, expect, it, vi } from "vitest";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import {
  actorId,
  collaborationSnapshot,
  communicationSession,
  epochId,
  epochOrdinal,
  operationTypeId,
  schemaAdmissionId,
  schemaId,
  schemaRevisionId,
  sessionId,
  withSession,
} from "@cantilune/core";
import {
  createActiveSchemaContext,
  createMutableBindingHolder,
  createMutablePolicyEvaluatorHolder,
  createMutableSchemaContextHolder,
  createDefaultSchema,
} from "@cantilune/runtime";
import { AdmissionRegistry } from "../../../src/admission/admissionRegistry.js";
import { createMemoryRuntimePersistence } from "../../../src/memory/memoryDurableCoordinator.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";
import { createMemoryEpochAdministration } from "../../../src/engine/memoryEpochAdministration.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import {
  activationDomainId,
  bindingGeneration,
  contentDigest,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  policyId,
  policyRevisionId,
  policyRef,
  schemaDigest,
  snapshotRef,
} from "@cantilune/core";
import type { SchemaEpochBinding, SchemaRef } from "@cantilune/core";
import { denyByDefaultPolicyEvaluator } from "../../../src/ports/policyEvaluator.js";
import { schemaContentDigest } from "../../../src/schema/schemaContentDigest.js";

function buildAdmin(options?: {
  initial?: ReturnType<typeof buildConfigT0>;
  resolveSchema?: (ref: SchemaRef) => ReturnType<typeof createDefaultSchema> | undefined;
}) {
  const t0 = options?.initial ?? buildConfigT0();
  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  const schema = createDefaultSchema();
  const binding: SchemaEpochBinding = {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schema.schemaId,
      revisionId: schemaRevisionId("rev-001"),
      digest: schemaContentDigest(schema),
    },
    policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("p1")),
    handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("h1")),
    runtimeHead: snapshotRef("snap-S0"),
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-11T00:00:00Z",
  };
  const schemaHolder = createMutableSchemaContextHolder(
    createActiveSchemaContext(schema, binding.epochId, binding),
  );
  const bindingHolder = createMutableBindingHolder(binding);
  const locks = new MemoryResourceLockTable();
  const admin = createMemoryEpochAdministration({
    durable,
    registry: new AdmissionRegistry(locks),
    locks,
    schemaHolder,
    bindingHolder,
    domainId: binding.activationDomainId,
    idGen: createDeterministicIdGenerator({ snapshotRefs: ["snap-E1"] }),
    resolveSchema: options?.resolveSchema ?? (() => schema),
    preparationTtlMs: 50,
  });
  return { admin, binding, schema, durable, schemaHolder, bindingHolder, locks, t0 };
}

describe("MemoryEpochAdministration", () => {
  it("prepares and commits epoch transition atomically", async () => {
    const initial = collaborationSnapshot({
      ...buildConfigT0(),
      heartbeatLog: [
        {
          agentId: actorId("planner-p"),
          sequenceNo: 1,
          emittedAt: "2026-08-13T00:00:00Z",
          turnCount: 7,
          lastAction: "write_content",
        },
      ],
    });
    const { admin, binding, bindingHolder, schemaHolder, durable } = buildAdmin({ initial });
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-1"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const committed = await admin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }
    expect(bindingHolder.get().epochId).toBe("43");
    expect(schemaHolder.get().epochId).toBe("43");
    expect(durable.get(committed.value.afterSnapshotRef)?.heartbeatLog).toEqual(
      initial.heartbeatLog,
    );

    const recovered = await admin.recoverEpochTransition(schemaAdmissionId("adm-runtime-1"));
    expect(recovered.ok).toBe(true);
  });

  it("rejects unknown activation domain and stale prepare preconditions", async () => {
    const { admin, binding } = buildAdmin();
    const inspect = await admin.inspectActivationPoint(activationDomainId("other"));
    expect(inspect.ok).toBe(false);

    const staleBinding = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-2"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: bindingGeneration(99),
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(staleBinding.ok).toBe(false);
  });

  it("rejects prepare when sessions active or target schema missing", async () => {
    const t0 = withSession(
      buildConfigT0(),
      communicationSession(
        sessionId("session-s"),
        actorId("planner-p"),
        [actorId("planner-p")],
        "private",
      ),
    );
    const { admin, binding } = buildAdmin({ initial: t0 });
    const notQuiescent = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-3"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(notQuiescent.ok).toBe(false);

    const { admin: admin2, binding: binding2 } = buildAdmin({ resolveSchema: () => undefined });
    const missingSchema = await admin2.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-4"),
      domainId: binding2.activationDomainId,
      expectedBindingGeneration: binding2.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding2.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(missingSchema.ok).toBe(false);
  });

  it("rejects expired prepared token and unknown commit token", async () => {
    const { admin, binding } = buildAdmin();
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-5"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
    const expired = await admin.commitEpochTransition(prepared.value);
    expect(expired.ok).toBe(false);

    const missing = await admin.commitEpochTransition({
      preparedId: "prep-unknown",
      planDigest: "{}",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(missing.ok).toBe(false);
  });

  it("exposes mutable policy evaluator holder", () => {
    const holder = createMutablePolicyEvaluatorHolder(denyByDefaultPolicyEvaluator());
    expect(holder.get().evaluate).toBeDefined();
    holder.set(denyByDefaultPolicyEvaluator());
  });

  it("rejects recover when no committed transition exists", async () => {
    const { admin } = buildAdmin();
    const recovered = await admin.recoverEpochTransition(schemaAdmissionId("adm-missing"));
    expect(recovered.ok).toBe(false);
  });

  it("rejects a missing commit-time schema before CAS and leaves both holders unchanged", async () => {
    let atCommit = false;
    const { admin, binding, durable, bindingHolder, schemaHolder } = buildAdmin({
      resolveSchema: () => (atCommit ? undefined : createDefaultSchema()),
    });
    const headBefore = durable.head();
    const bindingBefore = bindingHolder.get();
    const schemaBefore = schemaHolder.get();
    const cas = vi.spyOn(durable, "compareAndSwapHead");
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-6"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    atCommit = true;
    const committed = await admin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(false);
    expect(cas).not.toHaveBeenCalled();
    expect(durable.head()).toBe(headBefore);
    expect(bindingHolder.get()).toBe(bindingBefore);
    expect(schemaHolder.get()).toBe(schemaBefore);
  });

  it("rejects a schema whose content changes after prepare before CAS", async () => {
    const preparedSchema = createDefaultSchema();
    const { admin, binding, durable, bindingHolder, schemaHolder } = buildAdmin({
      resolveSchema: () => preparedSchema,
    });
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-schema-toctou"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const headBefore = durable.head();
    const bindingBefore = bindingHolder.get();
    const schemaBefore = schemaHolder.get();
    const cas = vi.spyOn(durable, "compareAndSwapHead");
    Object.assign(preparedSchema, { wireVersion: preparedSchema.wireVersion + 1 });

    const committed = await admin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(false);
    expect(cas).not.toHaveBeenCalled();
    expect(durable.head()).toBe(headBefore);
    expect(bindingHolder.get()).toBe(bindingBefore);
    expect(schemaHolder.get()).toBe(schemaBefore);
  });

  it("fails recovery when the committed schema is unavailable and does not mutate holders", async () => {
    const targetSchema = createDefaultSchema();
    let available = true;
    const { admin, binding, durable, bindingHolder, schemaHolder } = buildAdmin({
      resolveSchema: () => (available ? targetSchema : undefined),
    });
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-recover-schema"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect((await admin.commitEpochTransition(prepared.value)).ok).toBe(true);

    const restoredSchema = createActiveSchemaContext(targetSchema, binding.epochId, binding);
    schemaHolder.set(restoredSchema);
    bindingHolder.set(binding);
    const restoredSchemaSnapshot = schemaHolder.get();
    const restoredBindingSnapshot = bindingHolder.get();
    const headBefore = durable.head();
    available = false;

    const recovered = await admin.recoverEpochTransition(
      schemaAdmissionId("adm-runtime-recover-schema"),
    );
    expect(recovered.ok).toBe(false);
    expect(durable.head()).toBe(headBefore);
    expect(schemaHolder.get()).toBe(restoredSchemaSnapshot);
    expect(bindingHolder.get()).toBe(restoredBindingSnapshot);
  });

  it("rejects commit when head ref advanced after prepare", async () => {
    const { admin, binding, durable, t0 } = buildAdmin();
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-7"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "{}",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    const advanced = { ...t0, snapshotRef: snapshotRef("snap-S-advanced") };
    expect(durable.compareAndSwapHead(t0.snapshotRef, advanced)).toBe(true);
    expect(durable.head()).toBe("snap-S-advanced");
    const committed = await admin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(false);
  });

  it("rejects stale expected ordinal and non-advancing target epoch during prepare", async () => {
    const { admin, binding } = buildAdmin();
    const base = {
      admissionId: schemaAdmissionId("adm-runtime-preconditions"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(99),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(100),
      planDigest: "{}",
    };

    expect((await admin.prepareEpochTransition(base)).ok).toBe(false);
    expect(
      (
        await admin.prepareEpochTransition({
          ...base,
          admissionId: schemaAdmissionId("adm-runtime-same-epoch"),
          expectedEpochOrdinal: binding.epochOrdinal,
          targetEpochId: binding.epochId,
          targetEpochOrdinal: epochOrdinal(2),
        })
      ).ok,
    ).toBe(false);
  });

  it("rejects a tampered prepared token without moving head or holders", async () => {
    const { admin, binding, durable, bindingHolder, schemaHolder } = buildAdmin();
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-token"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "plan-a",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const headBefore = durable.head();
    const bindingBefore = bindingHolder.get();
    const schemaBefore = schemaHolder.get();

    const committed = await admin.commitEpochTransition({
      ...prepared.value,
      planDigest: "tampered-plan",
    });
    expect(committed.ok).toBe(false);
    expect(durable.head()).toBe(headBefore);
    expect(bindingHolder.get()).toBe(bindingBefore);
    expect(schemaHolder.get()).toBe(schemaBefore);
  });

  it("treats identical prepare and commit retries as idempotent", async () => {
    const { admin, binding } = buildAdmin();
    const request = {
      admissionId: schemaAdmissionId("adm-runtime-idempotent"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: epochId("42"),
      expectedEpochOrdinal: epochOrdinal(1),
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "plan-idempotent",
    };

    const firstPrepare = await admin.prepareEpochTransition(request);
    const retryPrepare = await admin.prepareEpochTransition(request);
    expect(firstPrepare).toEqual(retryPrepare);
    if (!firstPrepare.ok) return;
    if (!retryPrepare.ok) return;
    expect(firstPrepare.value).not.toBe(retryPrepare.value);

    const firstCommit = await admin.commitEpochTransition(firstPrepare.value);
    const retryCommit = await admin.commitEpochTransition(firstPrepare.value);
    expect(firstCommit).toEqual(retryCommit);
    if (firstCommit.ok && retryCommit.ok) {
      expect(firstCommit.value).not.toBe(retryCommit.value);
      expect(firstCommit.value.toBinding).not.toBe(retryCommit.value.toBinding);
    }
  });

  it("snapshots the prepare request and keeps returned tokens separate from CAS state", async () => {
    const { admin, binding, bindingHolder, durable } = buildAdmin();
    const request = {
      admissionId: schemaAdmissionId("adm-runtime-request-alias"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: binding.epochId,
      expectedEpochOrdinal: binding.epochOrdinal,
      targetSchemaRef: { ...binding.schemaRef },
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "request-alias",
    };
    const prepared = await admin.prepareEpochTransition(request);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    Object.assign(request, {
      targetEpochId: epochId("999"),
      targetEpochOrdinal: epochOrdinal(999),
      planDigest: "mutated-plan",
    });
    Object.assign(request.targetSchemaRef, {
      schemaId: schemaId("mutated-schema"),
      revisionId: schemaRevisionId("mutated-revision"),
    });
    expect(Object.isFrozen(prepared.value)).toBe(true);
    expect(() => Object.assign(prepared.value, { planDigest: "tampered" })).toThrow(TypeError);

    const committed = await admin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(durable.get(committed.value.afterSnapshotRef)?.epochId).toBe(epochId("43"));
    expect(bindingHolder.get().epochId).toBe(epochId("43"));
    expect(bindingHolder.get().schemaRef.schemaId).toBe(binding.schemaRef.schemaId);
    expect(committed.value.toBinding.schemaRef.schemaId).toBe(binding.schemaRef.schemaId);
  });

  it("rejects accessor-backed request and token fields without invoking getters", async () => {
    const { admin, binding, durable } = buildAdmin();
    let requestGetterCalls = 0;
    const accessorRequest = {
      admissionId: schemaAdmissionId("adm-runtime-request-accessor"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: binding.epochId,
      expectedEpochOrdinal: binding.epochOrdinal,
      targetSchemaRef: { ...binding.schemaRef },
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "request-accessor",
    };
    Object.defineProperty(accessorRequest, "planDigest", {
      enumerable: true,
      get: () => {
        requestGetterCalls++;
        return "getter-plan";
      },
    });
    expect((await admin.prepareEpochTransition(accessorRequest)).ok).toBe(false);
    expect(requestGetterCalls).toBe(0);

    const validPrepared = await admin.prepareEpochTransition({
      ...accessorRequest,
      admissionId: schemaAdmissionId("adm-runtime-token-accessor"),
      planDigest: "token-accessor",
    });
    expect(validPrepared.ok).toBe(true);
    if (!validPrepared.ok) return;
    let tokenGetterCalls = 0;
    const accessorToken = { ...validPrepared.value };
    Object.defineProperty(accessorToken, "planDigest", {
      enumerable: true,
      get: () => {
        tokenGetterCalls++;
        return "getter-plan";
      },
    });
    expect((await admin.commitEpochTransition(accessorToken)).ok).toBe(false);
    expect(tokenGetterCalls).toBe(0);
    expect(durable.head()).toBe(snapshotRef("snap-S0"));
  });

  it("snapshots holder inputs and committed target schema values", async () => {
    const mutableSchema = createDefaultSchema();
    const { admin, binding, schemaHolder, bindingHolder } = buildAdmin({
      resolveSchema: () => mutableSchema,
    });
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-holder-snapshots"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: binding.epochId,
      expectedEpochOrdinal: binding.epochOrdinal,
      targetSchemaRef: { ...binding.schemaRef },
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "holder-snapshots",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const committed = await admin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    const heldOperationCount = schemaHolder.get().schema.operationTypes.size;

    Object.assign(mutableSchema, { wireVersion: 99 });
    (mutableSchema.operationTypes as Map<unknown, unknown>).clear();
    expect(schemaHolder.get().schema.wireVersion).toBe(1);
    expect(schemaHolder.get().schema.operationTypes.size).toBe(heldOperationCount);
    expect(Object.isFrozen(committed.value)).toBe(true);
    expect(Object.isFrozen(committed.value.toBinding)).toBe(true);
    expect(() => Object.assign(committed.value.toBinding, { epochId: epochId("mutated") })).toThrow(
      TypeError,
    );
    expect(bindingHolder.get().epochId).toBe(epochId("43"));

    const externalBinding = {
      ...binding,
      schemaRef: { ...binding.schemaRef },
      policyRef: { ...binding.policyRef },
      handlerManifestRef: { ...binding.handlerManifestRef },
    };
    bindingHolder.set(externalBinding);
    Object.assign(externalBinding, { epochId: epochId("caller-mutated") });
    Object.assign(externalBinding.schemaRef, { digest: schemaDigest("caller-mutated") });
    expect(bindingHolder.get().epochId).toBe(binding.epochId);
    expect(bindingHolder.get().schemaRef.digest).toBe(binding.schemaRef.digest);
    expect(Object.isFrozen(bindingHolder.get().schemaRef)).toBe(true);
  });

  it("rejects malformed resolved schemas before creating a prepared transition", async () => {
    const baseSchema = createDefaultSchema();
    const firstTemplate = baseSchema.templates[0]!;
    const firstDeclaration = [...baseSchema.operationTypes.entries()][0]!;
    const declarationMismatch = new Map(baseSchema.operationTypes);
    declarationMismatch.set(firstDeclaration[0], {
      ...firstDeclaration[1],
      operationTypeId: operationTypeId("wrong-operation"),
    });

    const malformedSchemas = [
      { ...baseSchema, schemaId: schemaId("wrong-schema") },
      { ...baseSchema, wireVersion: 0 },
      {
        ...baseSchema,
        templates: [
          {
            ...firstTemplate,
            operationTypeId: operationTypeId("wrong-operation"),
          },
          ...baseSchema.templates.slice(1),
        ],
      },
      { ...baseSchema, templates: [...baseSchema.templates, firstTemplate] },
      { ...baseSchema, operationTypes: declarationMismatch },
      { ...baseSchema, templates: [] },
    ];

    for (const [index, malformed] of malformedSchemas.entries()) {
      const { admin, binding, durable } = buildAdmin({ resolveSchema: () => malformed });
      const prepared = await admin.prepareEpochTransition({
        admissionId: schemaAdmissionId(`adm-runtime-malformed-${String(index)}`),
        domainId: binding.activationDomainId,
        expectedBindingGeneration: binding.bindingGeneration,
        expectedHead: snapshotRef("snap-S0"),
        expectedEpochId: binding.epochId,
        expectedEpochOrdinal: binding.epochOrdinal,
        targetSchemaRef: binding.schemaRef,
        targetEpochId: epochId("43"),
        targetEpochOrdinal: epochOrdinal(2),
        planDigest: "malformed-schema",
      });
      expect(prepared.ok).toBe(false);
      expect(durable.head()).toBe(snapshotRef("snap-S0"));
    }
  });

  it("rejects a resolver value that cannot be detached into the preparation cache", async () => {
    const schemaWithUncloneableValue = Object.assign(createDefaultSchema(), {
      resolverOwnedCallback: () => undefined,
    });
    const { admin, binding } = buildAdmin({ resolveSchema: () => schemaWithUncloneableValue });
    const prepared = await admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-uncloneable-schema"),
      domainId: binding.activationDomainId,
      expectedBindingGeneration: binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: binding.epochId,
      expectedEpochOrdinal: binding.epochOrdinal,
      targetSchemaRef: binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "uncloneable-schema",
    });
    expect(prepared.ok).toBe(false);
  });

  it("rejects a binding race and a failed durable CAS without updating epoch holders", async () => {
    const first = buildAdmin();
    const firstPrepared = await first.admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-binding-race"),
      domainId: first.binding.activationDomainId,
      expectedBindingGeneration: first.binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: first.binding.epochId,
      expectedEpochOrdinal: first.binding.epochOrdinal,
      targetSchemaRef: first.binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "binding-race",
    });
    expect(firstPrepared.ok).toBe(true);
    if (!firstPrepared.ok) return;
    first.bindingHolder.set({
      ...first.binding,
      bindingGeneration: bindingGeneration(2),
    });
    expect((await first.admin.commitEpochTransition(firstPrepared.value)).ok).toBe(false);
    expect(first.durable.head()).toBe(snapshotRef("snap-S0"));
    expect(first.schemaHolder.get().epochId).toBe(epochId("42"));

    const second = buildAdmin();
    const secondPrepared = await second.admin.prepareEpochTransition({
      admissionId: schemaAdmissionId("adm-runtime-cas-race"),
      domainId: second.binding.activationDomainId,
      expectedBindingGeneration: second.binding.bindingGeneration,
      expectedHead: snapshotRef("snap-S0"),
      expectedEpochId: second.binding.epochId,
      expectedEpochOrdinal: second.binding.epochOrdinal,
      targetSchemaRef: second.binding.schemaRef,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      planDigest: "cas-race",
    });
    expect(secondPrepared.ok).toBe(true);
    if (!secondPrepared.ok) return;
    // The epoch commit advances head and binding in one atomic CAS
    // (compareAndSwapHeadWithBinding, ADR-0014). Simulating a head race here
    // must leave both the head and the holders unchanged.
    vi.spyOn(second.durable, "compareAndSwapHeadWithBinding").mockReturnValue(false);
    expect((await second.admin.commitEpochTransition(secondPrepared.value)).ok).toBe(false);
    expect(second.bindingHolder.get().epochId).toBe(epochId("42"));
    expect(second.schemaHolder.get().epochId).toBe(epochId("42"));
  });
});
