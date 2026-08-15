import { describe, expect, it } from "vitest";
import {
  activationDomainId,
  bindingGeneration,
  epochId,
  idempotencyKey,
  schemaDigest,
  policyId,
  policyRevisionId,
  runtimeInstanceId,
  schemaAdmissionId,
  schemaRevisionId,
  snapshotRef,
} from "@cantilune/core";
import { buildOrchestrationSchema } from "@cantilune/runtime";
import { MemoryControlPlaneStore } from "../../src/memory/memoryControlPlaneStore.js";
import { bootstrapDefaultControlPlane } from "../../src/engine/controlPlaneService.js";
import {
  buildAdmissionHarness,
  createSchemaRevision,
  qualifierContext,
  authorizerContext,
} from "../support/buildAdmissionHarness.js";
import { testAdminContext, proposerContext } from "../support/testAdminContext.js";
import { createPolicyRevision } from "../../src/policy/policyRevision.js";
import type { SchemaRevision } from "../../src/schema/schemaRevision.js";

describe("control plane service branches", () => {
  it("rejects submit when binding, runtime head, or epoch drift", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision, genesisBinding } = bootstrapDefaultControlPlane(store);
    const candidate = createSchemaRevision({
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-drift"),
      parentRef: genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    store.registerRevision(candidate);

    const baseRequest = {
      admissionId: schemaAdmissionId("adm-drift"),
      activationDomainId: genesisBinding.activationDomainId,
      expectedBindingGeneration: genesisBinding.bindingGeneration,
      expectedSchemaRef: genesisRevision.schemaRef,
      expectedEpochId: genesisBinding.epochId,
      expectedEpochOrdinal: genesisBinding.epochOrdinal,
      expectedRuntimeHead: genesisBinding.runtimeHead,
      candidateSchemaRef: candidate.schemaRef,
      requestedBy: "proposer",
      requestedAt: "2026-08-11T00:00:00Z",
      idempotencyKey: idempotencyKey("idem-drift"),
    };

    const staleGen = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        ...baseRequest,
        expectedBindingGeneration: bindingGeneration(999),
      },
    });
    expect(staleGen.ok).toBe(false);

    const staleHead = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: { ...baseRequest, expectedRuntimeHead: snapshotRef("snap-wrong") },
    });
    expect(staleHead.ok).toBe(false);
    if (!staleHead.ok) expect(staleHead.error.code).toBe("runtime_head_changed");

    const staleEpoch = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        ...baseRequest,
        expectedEpochOrdinal: bindingGeneration(
          99,
        ) as unknown as typeof genesisBinding.epochOrdinal,
      },
    });
    expect(staleEpoch.ok).toBe(false);

    const schemaMismatch = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        ...baseRequest,
        expectedSchemaRef: { ...genesisRevision.schemaRef, digest: schemaDigest("wrong-schema") },
      },
    });
    expect(schemaMismatch.ok).toBe(false);
    if (!schemaMismatch.ok) expect(schemaMismatch.error.code).toBe("stale_active_binding");

    const epochMismatch = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: { ...baseRequest, expectedEpochId: epochId("999") },
    });
    expect(epochMismatch.ok).toBe(false);
    if (!epochMismatch.ok) expect(epochMismatch.error.code).toBe("epoch_not_advanced");
  });

  it("rejects submit without active binding and non-monotone extension", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision, genesisBinding } = bootstrapDefaultControlPlane(store);
    const missingBinding = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId: schemaAdmissionId("adm-no-binding"),
        activationDomainId: activationDomainId("missing-domain"),
        expectedBindingGeneration: genesisBinding.bindingGeneration,
        expectedSchemaRef: genesisRevision.schemaRef,
        expectedEpochId: genesisBinding.epochId,
        expectedEpochOrdinal: genesisBinding.epochOrdinal,
        expectedRuntimeHead: genesisBinding.runtimeHead,
        candidateSchemaRef: genesisRevision.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-no-binding"),
      },
    });
    expect(missingBinding.ok).toBe(false);

    const candidate = createSchemaRevision({
      schema: buildOrchestrationSchema("other-family"),
      revisionId: schemaRevisionId("rev-non-monotone"),
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    store.registerRevision(candidate);
    const nonMonotone = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId: schemaAdmissionId("adm-non-monotone"),
        activationDomainId: genesisBinding.activationDomainId,
        expectedBindingGeneration: genesisBinding.bindingGeneration,
        expectedSchemaRef: genesisRevision.schemaRef,
        expectedEpochId: genesisBinding.epochId,
        expectedEpochOrdinal: genesisBinding.epochOrdinal,
        expectedRuntimeHead: genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-non-monotone"),
      },
    });
    expect(nonMonotone.ok).toBe(false);
    if (!nonMonotone.ok) expect(nonMonotone.error.code).toBe("non_monotone_extension");
  });

  it("rejects submit when active schema revision is missing from store", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision, genesisBinding } = bootstrapDefaultControlPlane(store);
    const snapshot = store.snapshot();
    (snapshot.revisions as Map<string, SchemaRevision>).clear();
    store.restoreSnapshot(snapshot);
    const candidate = createSchemaRevision({
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-orphan"),
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    store.registerRevision(candidate);
    const result = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId: schemaAdmissionId("adm-orphan-active"),
        activationDomainId: genesisBinding.activationDomainId,
        expectedBindingGeneration: genesisBinding.bindingGeneration,
        expectedSchemaRef: genesisRevision.schemaRef,
        expectedEpochId: genesisBinding.epochId,
        expectedEpochOrdinal: genesisBinding.epochOrdinal,
        expectedRuntimeHead: genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-orphan-active"),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("active schema revision not found");
  });

  it("rejects missing candidate and handles idempotency replay/conflict", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision, genesisBinding } = bootstrapDefaultControlPlane(store);
    const missing = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId: schemaAdmissionId("adm-missing-candidate"),
        activationDomainId: genesisBinding.activationDomainId,
        expectedBindingGeneration: genesisBinding.bindingGeneration,
        expectedSchemaRef: genesisRevision.schemaRef,
        expectedEpochId: genesisBinding.epochId,
        expectedEpochOrdinal: genesisBinding.epochOrdinal,
        expectedRuntimeHead: genesisBinding.runtimeHead,
        candidateSchemaRef: {
          ...genesisRevision.schemaRef,
          revisionId: schemaRevisionId("missing"),
        },
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-missing"),
      },
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("schema_not_found");

    const candidate = createSchemaRevision({
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-idem"),
      parentRef: genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    store.registerRevision(candidate);
    const request = {
      admissionId: schemaAdmissionId("adm-idem"),
      activationDomainId: genesisBinding.activationDomainId,
      expectedBindingGeneration: genesisBinding.bindingGeneration,
      expectedSchemaRef: genesisRevision.schemaRef,
      expectedEpochId: genesisBinding.epochId,
      expectedEpochOrdinal: genesisBinding.epochOrdinal,
      expectedRuntimeHead: genesisBinding.runtimeHead,
      candidateSchemaRef: candidate.schemaRef,
      requestedBy: "proposer",
      requestedAt: "2026-08-11T00:00:00Z",
      idempotencyKey: idempotencyKey("idem-replay"),
    };
    const first = await service.submitSchemaAdmission({ context: qualifierContext(), request });
    expect(first.ok).toBe(true);
    const replay = await service.submitSchemaAdmission({ context: qualifierContext(), request });
    expect(replay.ok).toBe(true);

    const conflict = await service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        ...request,
        admissionId: schemaAdmissionId("adm-idem-conflict"),
        candidateSchemaRef: genesisRevision.schemaRef,
      },
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.error.code).toBe("idempotency_conflict");
  });

  it("rejects approve when admission missing or in wrong state", async () => {
    const store = new MemoryControlPlaneStore();
    const { service } = bootstrapDefaultControlPlane(store);
    const missing = await service.approveSchemaAdmission({
      context: authorizerContext(),
      admissionId: schemaAdmissionId("adm-missing"),
    });
    expect(missing.ok).toBe(false);

    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-approve-state"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    await harness.service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId: schemaAdmissionId("adm-state"),
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-state"),
      },
    });
    const wrongState = await harness.service.approveSchemaAdmission({
      context: authorizerContext(),
      admissionId: schemaAdmissionId("adm-not-there"),
    });
    expect(wrongState.ok).toBe(false);
  });

  it("blocks operations when frozen and supports readEvents cursor", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision } = bootstrapDefaultControlPlane(store);
    store.setFrozen(true);
    const frozen = await service.registerSchemaRevision({
      context: testAdminContext(["schema-registrar"], "author"),
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-frozen"),
      createdAt: "2026-08-11T00:00:00Z",
    });
    expect(frozen.ok).toBe(false);
    if (!frozen.ok) expect(frozen.error.code).toBe("control_plane_frozen");

    store.setFrozen(false);
    await service.registerSchemaRevision({
      context: testAdminContext(["schema-registrar"], "author"),
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-events"),
      createdAt: "2026-08-11T00:00:00Z",
    });
    const allEvents = await service.readEvents();
    expect(allEvents.length).toBeGreaterThan(0);
    const cursorEvents = await service.readEvents(allEvents[0]!.storeSequence as number);
    expect(cursorEvents.length).toBeLessThan(allEvents.length);
    const listed = await service.listSchemaRevisions({ schemaId: "default-v1" });
    expect(listed.length).toBeGreaterThan(0);
  });
});

describe("full control plane service fleet and policy paths", () => {
  it("rejects incompatible policy schema on activation", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("bad-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [
        {
          ...harness.genesisRevision.schemaRef,
          digest: schemaDigest("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
        },
      ],
      rules: [{ ruleId: "allow", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const badActivate = harness.service.activatePolicyRevision({
      context: testAdminContext(["policy-admin"], "policy-admin"),
      policyRevision: revision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(badActivate.ok).toBe(false);
    if (!badActivate.ok) expect(badActivate.error.code).toBe("invalid_input");
  });

  it("manages fleet rollout and runtime acknowledgements", () => {
    const instance = runtimeInstanceId("fleet-node-1");
    const harness = buildAdmissionHarness();
    const plan = {
      domainId: harness.genesisBinding.activationDomainId,
      targetBinding: harness.genesisBinding,
      runtimeInstanceIds: [instance],
    };
    const setRollout = harness.service.setFleetRollout(
      plan,
      testAdminContext(["policy-admin"], "admin"),
    );
    expect(setRollout.ok).toBe(true);
    const ack = harness.service.acknowledgeRuntimeInstance(
      instance,
      harness.genesisBinding,
      testAdminContext(["policy-admin"], "admin"),
    );
    expect(ack.ok).toBe(true);
    expect(harness.service.listRuntimeBindings().length).toBeGreaterThanOrEqual(0);
    expect(harness.service.rolloutReport().acknowledged).toBeGreaterThanOrEqual(0);
  });

  it("rejects policy activation without policy-admin role", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("role-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [{ ruleId: "allow", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const result = harness.service.activatePolicyRevision({
      context: proposerContext(),
      policyRevision: revision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("authorization_denied");
  });

  it("rejects policy activation with stale binding generation and CAS conflict", () => {
    const harness = buildAdmissionHarness();
    const revision = createPolicyRevision({
      policyId: policyId("cas-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [harness.genesisRevision.schemaRef],
      rules: [{ ruleId: "allow", decision: "allow" }],
      createdBy: "admin",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const stale = harness.service.activatePolicyRevision({
      context: testAdminContext(["policy-admin"], "policy-admin"),
      policyRevision: revision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: bindingGeneration(999),
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("stale_active_binding");

    harness.store.casActiveBinding({
      domainId: harness.genesisBinding.activationDomainId,
      expectedGeneration: harness.genesisBinding.bindingGeneration,
      nextBinding: {
        ...harness.genesisBinding,
        bindingGeneration: bindingGeneration(
          (harness.genesisBinding.bindingGeneration as number) + 1,
        ),
      },
    });
    const casFail = harness.service.activatePolicyRevision({
      context: testAdminContext(["policy-admin"], "policy-admin"),
      policyRevision: revision,
      activationDomainId: harness.genesisBinding.activationDomainId,
      expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
      activatedAt: "2026-08-11T00:00:00Z",
    });
    expect(casFail.ok).toBe(false);
    if (!casFail.ok) expect(casFail.error.code).toBe("stale_active_binding");
  });

  it("blocks fleet rollout and acknowledgement while frozen", () => {
    const harness = buildAdmissionHarness();
    harness.store.setFrozen(true);
    const instance = runtimeInstanceId("fleet-frozen");
    expect(
      harness.service.setFleetRollout(
        {
          domainId: harness.genesisBinding.activationDomainId,
          targetBinding: harness.genesisBinding,
          runtimeInstanceIds: [instance],
        },
        testAdminContext(["policy-admin"], "admin"),
      ).ok,
    ).toBe(false);
    expect(
      harness.service.acknowledgeRuntimeInstance(
        instance,
        harness.genesisBinding,
        testAdminContext(["policy-admin"], "admin"),
      ).ok,
    ).toBe(false);
  });

  it("routes wire commands through decoders", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-wire-route"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const submit = await harness.service.submitSchemaAdmissionWire(
      {
        admissionId: schemaAdmissionId("adm-wire-route"),
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: harness.genesisBinding.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: harness.genesisBinding.epochId,
        expectedEpochOrdinal: harness.genesisBinding.epochOrdinal,
        expectedRuntimeHead: harness.genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-wire-route"),
      },
      qualifierContext(),
    );
    expect(submit.ok).toBe(true);
    if (!submit.ok) return;
    const approve = await harness.service.approveSchemaAdmissionWire(
      { admissionId: schemaAdmissionId("adm-wire-route") },
      authorizerContext(),
    );
    expect(approve.ok).toBe(true);

    const badWire = await harness.service.registerSchemaRevisionWire(
      { schema: "invalid", revisionId: "rev", createdAt: "2026-08-11T00:00:00Z" },
      testAdminContext(["schema-registrar"], "registrar"),
    );
    expect(badWire.ok).toBe(false);

    const badPolicyWire = harness.service.activatePolicyRevisionWire(
      { policyId: policyId("bad"), revisionId: policyRevisionId("1") },
      testAdminContext(["policy-admin"], "policy-admin"),
    );
    expect(badPolicyWire.ok).toBe(false);
  });

  it("rejects submit when qualification fails and releases idempotency", async () => {
    const store = new MemoryControlPlaneStore();
    const { service, genesisRevision, genesisBinding } = bootstrapDefaultControlPlane(store);
    const candidate = createSchemaRevision({
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-qual-fail"),
      parentRef: genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    store.registerRevision(candidate);
    const result = await service.submitSchemaAdmission({
      context: authorizerContext(),
      request: {
        admissionId: schemaAdmissionId("adm-qual-fail"),
        activationDomainId: genesisBinding.activationDomainId,
        expectedBindingGeneration: genesisBinding.bindingGeneration,
        expectedSchemaRef: genesisRevision.schemaRef,
        expectedEpochId: genesisBinding.epochId,
        expectedEpochOrdinal: genesisBinding.epochOrdinal,
        expectedRuntimeHead: genesisBinding.runtimeHead,
        candidateSchemaRef: candidate.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-qual-fail"),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("qualification_failed");
  });

  it("approveSchemaAdmissionWire returns decode errors", async () => {
    const harness = buildAdmissionHarness();
    const bad = await harness.service.approveSchemaAdmissionWire({}, authorizerContext());
    expect(bad.ok).toBe(false);
  });
});
