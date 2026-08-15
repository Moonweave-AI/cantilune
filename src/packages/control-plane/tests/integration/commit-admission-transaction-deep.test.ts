import { describe, expect, it, vi } from "vitest";
import {
  bindingGeneration,
  contentDigest,
  epochId,
  epochOrdinal,
  idempotencyKey,
  planDigest,
  preparedAdmissionId,
  schemaAdmissionId,
  schemaRevisionId,
  type SchemaAdmissionId,
  type SchemaAdmissionReceipt,
} from "@cantilune/core";
import {
  buildAdmissionHarness,
  createSchemaRevision,
  qualifierContext,
} from "../support/buildAdmissionHarness.js";
import {
  executeCommitAdmissionTransaction,
  recoverForwardCommit,
} from "../../src/engine/commitAdmissionTransaction.js";
import { createAdministrationAuthorizer } from "../../src/administration/administrationAuthorizer.js";
import { createControlPlaneOutbox } from "../../src/events/controlPlaneOutbox.js";
import {
  createMemoryEpochAdministration,
  createMutableBindingHolder,
  createMutableSchemaContextHolder,
  createActiveSchemaContext,
  AdmissionRegistry,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { createDeterministicIdGenerator } from "../support/deterministicIds.js";

function buildEpochAdmin(harness: ReturnType<typeof buildAdmissionHarness>) {
  const t0 = buildConfigT0();
  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  const registry = new AdmissionRegistry(locks);
  const schemaHolder = createMutableSchemaContextHolder(
    createActiveSchemaContext(
      harness.genesisRevision.schema,
      harness.genesisBinding.epochId,
      harness.genesisBinding,
    ),
  );
  const bindingHolder = createMutableBindingHolder(harness.genesisBinding);
  return createMemoryEpochAdministration({
    durable,
    registry,
    locks,
    schemaHolder,
    bindingHolder,
    domainId: harness.genesisBinding.activationDomainId,
    idGen: createDeterministicIdGenerator({ snapshotRefs: ["snap-E1", "snap-E2", "snap-E3"] }),
    resolveSchema: (ref) =>
      harness.revisions.get(`${ref.schemaId}@${ref.revisionId}`)?.schema ??
      harness.genesisRevision.schema,
  });
}

describe("commit admission transaction deep branches", () => {
  it("recoverForwardCommit rejects missing evidence during recovery", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-txn-evidence"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-txn-evidence");
    const committed = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-txn-evidence"),
      requestedAt: "2026-08-11T00:00:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const decision = harness.store.getCommitDecision(admissionId)!;
    harness.store.putCommitDecision({ ...decision, status: "recovery_required" });
    const snapshot = harness.store.snapshot();
    (snapshot.commitReceipts as Map<SchemaAdmissionId, SchemaAdmissionReceipt>).delete(admissionId);
    harness.store.restoreSnapshot(snapshot);
    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    const { qualification: _qualification, ...recordWithoutQualification } = record;
    harness.store.putAdmission({
      ...recordWithoutQualification,
      updatedAt: record.updatedAt,
    });
    const epochAdmin = buildEpochAdmin(harness);
    vi.spyOn(epochAdmin, "recoverEpochTransition").mockResolvedValue({
      ok: true,
      value: {
        admissionId,
        beforeSnapshotRef: committed.value.beforeSnapshotRef,
        afterSnapshotRef: committed.value.afterSnapshotRef,
        toBinding: decision.toBinding!,
      },
    } as never);
    const deps = {
      store: harness.store,
      epochAdmin,
      authorizer: createAdministrationAuthorizer(),
      outbox: createControlPlaneOutbox(),
      updateBinding: () => undefined,
    };
    const recovered = await recoverForwardCommit(deps, admissionId);
    expect(recovered.ok).toBe(false);
    if (!recovered.ok) expect(recovered.error.message).toContain("missing evidence");
    vi.restoreAllMocks();
  });

  it("executeCommitAdmissionTransaction marks recovery_required when runtime apply fails", async () => {
    const harness = buildAdmissionHarness();
    const epochAdmin = buildEpochAdmin(harness);
    const deps = {
      store: harness.store,
      epochAdmin,
      authorizer: createAdministrationAuthorizer(),
      outbox: createControlPlaneOutbox(),
      updateBinding: () => undefined,
    };
    vi.spyOn(epochAdmin, "commitEpochTransition").mockResolvedValue({
      ok: false,
      error: { message: "runtime commit failed" },
    } as never);
    vi.spyOn(epochAdmin, "recoverEpochTransition").mockResolvedValue({
      ok: false,
      error: { message: "no recovery" },
    } as never);

    const admissionId = schemaAdmissionId("adm-runtime-fail");
    const active = harness.store.getActiveBinding(harness.genesisBinding.activationDomainId)!;
    const record = {
      request: {
        admissionId,
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: active.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: active.epochId,
        expectedEpochOrdinal: active.epochOrdinal,
        expectedRuntimeHead: active.runtimeHead,
        candidateSchemaRef: harness.genesisRevision.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-runtime-fail"),
      },
      state: "prepared" as const,
      qualification: {
        subjectDigest: contentDigest("subj"),
        extensionPlanDigest: planDigest("plan"),
        qualifiedBy: "qualifier",
        qualifiedAt: "2026-08-11T00:00:00Z",
        evaluatorVersion: "qualification/1.0",
      },
      authorization: {
        subjectDigest: contentDigest("subj"),
        qualificationDigest: "{}",
        authorizedBy: "authorizer",
        authorizedAt: "2026-08-11T00:00:00Z",
        expiresAt: "2099-01-01T00:00:00Z",
        authorizerVersion: "authorizer/1.0",
      },
      updatedAt: "2026-08-11T00:00:00Z",
    };
    harness.store.putAdmission(record);
    const preparedId = preparedAdmissionId("prep-runtime-fail");
    const preparedRecord = {
      preparedId,
      admissionId,
      activationDomainId: harness.genesisBinding.activationDomainId,
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: harness.genesisRevision.schemaRef,
      fromEpochId: active.epochId,
      toEpochId: epochId("99"),
      fromEpochOrdinal: active.epochOrdinal,
      toEpochOrdinal: epochOrdinal(2),
      expectedBindingGeneration: active.bindingGeneration,
      expectedRuntimeHead: active.runtimeHead,
      planDigest: planDigest("plan"),
      runtimePreparedId: "runtime-prep-fail",
      issuedAt: "2026-08-11T00:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
      consumed: false,
    };
    harness.store.putPrepared(preparedRecord);
    const result = await executeCommitAdmissionTransaction(deps, {
      admissionId,
      preparedId,
      operator: "operator",
      record,
      active,
      preparedRecord,
    });
    expect(result.ok).toBe(false);
    expect(harness.store.getCommitDecision(admissionId)?.status).toBe("recovery_required");
    vi.restoreAllMocks();
  });

  it("executeCommitAdmissionTransaction rejects unexpected commit decision state", async () => {
    const harness = buildAdmissionHarness();
    const admissionId = schemaAdmissionId("adm-bad-state");
    const active = harness.store.getActiveBinding(harness.genesisBinding.activationDomainId)!;
    harness.store.putCommitDecision({
      admissionId,
      preparedId: preparedAdmissionId("prep-bad-state"),
      expectedBindingGeneration: active.bindingGeneration,
      status: "finalized",
      operator: "operator",
      updatedAt: "2026-08-11T00:00:00Z",
    });
    const record = (await harness.service.submitSchemaAdmission({
      context: qualifierContext(),
      request: {
        admissionId,
        activationDomainId: harness.genesisBinding.activationDomainId,
        expectedBindingGeneration: active.bindingGeneration,
        expectedSchemaRef: harness.genesisRevision.schemaRef,
        expectedEpochId: active.epochId,
        expectedEpochOrdinal: active.epochOrdinal,
        expectedRuntimeHead: active.runtimeHead,
        candidateSchemaRef: harness.genesisRevision.schemaRef,
        requestedBy: "proposer",
        requestedAt: "2026-08-11T00:00:00Z",
        idempotencyKey: idempotencyKey("idem-bad-state"),
      },
    })) as { ok: true; value: never };
    const deps = {
      store: harness.store,
      epochAdmin: buildEpochAdmin(harness),
      authorizer: createAdministrationAuthorizer(),
      outbox: createControlPlaneOutbox(),
      updateBinding: () => undefined,
    };
    const preparedRecord = {
      preparedId: preparedAdmissionId("prep-bad-state"),
      admissionId,
      activationDomainId: harness.genesisBinding.activationDomainId,
      fromSchemaRef: harness.genesisRevision.schemaRef,
      toSchemaRef: harness.genesisRevision.schemaRef,
      fromEpochId: active.epochId,
      toEpochId: epochId("99"),
      fromEpochOrdinal: active.epochOrdinal,
      toEpochOrdinal: epochOrdinal(2),
      expectedBindingGeneration: active.bindingGeneration,
      expectedRuntimeHead: active.runtimeHead,
      planDigest: planDigest("plan"),
      runtimePreparedId: "runtime-prep",
      issuedAt: "2026-08-11T00:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
      consumed: false,
    };
    const result = await executeCommitAdmissionTransaction(deps, {
      admissionId,
      preparedId: preparedRecord.preparedId,
      operator: "operator",
      record: record.value,
      active,
      preparedRecord,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("unexpected commit decision state");
  });

  it("recoverForwardCommit returns existing receipt when binding already matches", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-txn-receipt"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-txn-receipt");
    const committed = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-txn-receipt"),
      requestedAt: "2026-08-11T00:00:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const decision = harness.store.getCommitDecision(admissionId)!;
    harness.store.putCommitDecision({ ...decision, status: "recovery_required" });
    const epochAdmin = buildEpochAdmin(harness);
    vi.spyOn(epochAdmin, "recoverEpochTransition").mockResolvedValue({
      ok: true,
      value: {
        admissionId,
        beforeSnapshotRef: committed.value.beforeSnapshotRef,
        afterSnapshotRef: committed.value.afterSnapshotRef,
        toBinding: committed.value.toBinding,
      },
    } as never);
    const deps = {
      store: harness.store,
      epochAdmin,
      authorizer: createAdministrationAuthorizer(),
      outbox: createControlPlaneOutbox(),
      updateBinding: () => undefined,
    };
    const recovered = await recoverForwardCommit(deps, admissionId);
    expect(recovered.ok).toBe(true);
    vi.restoreAllMocks();
  });

  it("recoverForwardCommit rejects finalize CAS conflict", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-txn-cas"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-txn-cas");
    const committed = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-txn-cas"),
      requestedAt: "2026-08-11T00:00:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const decision = harness.store.getCommitDecision(admissionId)!;
    const snapshot = harness.store.snapshot();
    (snapshot.commitReceipts as Map<SchemaAdmissionId, SchemaAdmissionReceipt>).delete(admissionId);
    harness.store.restoreSnapshot(snapshot);
    harness.store.putCommitDecision({ ...decision, status: "recovery_required" });

    const epochAdmin = buildEpochAdmin(harness);
    vi.spyOn(epochAdmin, "recoverEpochTransition").mockResolvedValue({
      ok: true,
      value: {
        admissionId,
        beforeSnapshotRef: committed.value.beforeSnapshotRef,
        afterSnapshotRef: committed.value.afterSnapshotRef,
        toBinding: decision.toBinding!,
      },
    } as never);

    harness.store.casActiveBinding({
      domainId: harness.genesisBinding.activationDomainId,
      expectedGeneration: decision.expectedBindingGeneration,
      nextBinding: {
        ...committed.value.fromBinding,
        bindingGeneration: bindingGeneration(999),
      },
    });

    const deps = {
      store: harness.store,
      epochAdmin,
      authorizer: createAdministrationAuthorizer(),
      outbox: createControlPlaneOutbox(),
      updateBinding: () => undefined,
    };
    const recovered = await recoverForwardCommit(deps, admissionId);
    expect(recovered.ok).toBe(false);
    if (!recovered.ok) expect(recovered.error.code).toBe("commit_conflict");
    vi.restoreAllMocks();
  });

  it("recoverForwardCommit rejects when epoch recovery fails", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-txn-epoch-fail"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-txn-epoch-fail");
    const committed = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-txn-epoch-fail"),
      requestedAt: "2026-08-11T00:00:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const decision = harness.store.getCommitDecision(admissionId)!;
    const snapshot = harness.store.snapshot();
    (snapshot.commitReceipts as Map<SchemaAdmissionId, SchemaAdmissionReceipt>).delete(admissionId);
    harness.store.restoreSnapshot(snapshot);
    harness.store.putCommitDecision({ ...decision, status: "recovery_required" });

    const epochAdmin = buildEpochAdmin(harness);
    vi.spyOn(epochAdmin, "recoverEpochTransition").mockResolvedValue({
      ok: false,
      error: { message: "epoch recovery failed" },
    } as never);

    const deps = {
      store: harness.store,
      epochAdmin,
      authorizer: createAdministrationAuthorizer(),
      outbox: createControlPlaneOutbox(),
      updateBinding: () => undefined,
    };
    const recovered = await recoverForwardCommit(deps, admissionId);
    expect(recovered.ok).toBe(false);
    if (!recovered.ok) expect(recovered.error.code).toBe("commit_conflict");
    vi.restoreAllMocks();
  });
});
