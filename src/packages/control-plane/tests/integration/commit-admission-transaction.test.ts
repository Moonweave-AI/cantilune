import { describe, expect, it } from "vitest";
import {
  idempotencyKey,
  preparedAdmissionId,
  schemaAdmissionId,
  schemaRevisionId,
} from "@cantilune/core";
import {
  buildAdmissionHarness,
  createSchemaRevision,
  authorizerContext,
} from "../support/buildAdmissionHarness.js";
import { recoverForwardCommit } from "../../src/engine/commitAdmissionTransaction.js";
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

function transactionDeps(harness: ReturnType<typeof buildAdmissionHarness>) {
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
  const epochAdmin = createMemoryEpochAdministration({
    durable,
    registry,
    locks,
    schemaHolder,
    bindingHolder,
    domainId: harness.genesisBinding.activationDomainId,
    idGen: createDeterministicIdGenerator({ snapshotRefs: ["snap-E1", "snap-E2"] }),
    resolveSchema: (ref) =>
      harness.revisions.get(`${ref.schemaId}@${ref.revisionId}`)?.schema ??
      harness.genesisRevision.schema,
  });
  return {
    store: harness.store,
    epochAdmin,
    authorizer: createAdministrationAuthorizer(),
    outbox: createControlPlaneOutbox(),
    updateBinding: (binding: Parameters<typeof bindingHolder.set>[0]) => bindingHolder.set(binding),
  };
}

describe("commit admission transaction branches", () => {
  it("recoverForwardCommit returns receipt for finalized decision", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-txn-final"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-txn-final");
    const committed = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-txn-final"),
      requestedAt: "2026-08-11T00:00:00Z",
    });
    expect(committed.ok).toBe(true);
    const deps = transactionDeps(harness);
    const recovered = await recoverForwardCommit(deps, admissionId);
    expect(recovered.ok).toBe(true);
  });

  it("recoverForwardCommit rejects when decision lacks toBinding", async () => {
    const harness = buildAdmissionHarness();
    const deps = transactionDeps(harness);
    expect((await recoverForwardCommit(deps, schemaAdmissionId("adm-missing-decision"))).ok).toBe(
      false,
    );
  });

  it("recoverForwardCommit rejects decided status without runtime apply", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-txn-decided"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-txn-decided");
    await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-txn-decided"),
      requestedAt: "2026-08-11T00:00:00Z",
    });
    const decision = harness.store.getCommitDecision(admissionId)!;
    harness.store.putCommitDecision({ ...decision, status: "decided" });
    const deps = transactionDeps(harness);
    expect((await recoverForwardCommit(deps, admissionId)).ok).toBe(false);
  });

  it("commitSchemaAdmission forward-recovers when admission state is not prepared", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-txn-forward"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    harness.registerRevision(candidate);
    const admissionId = schemaAdmissionId("adm-txn-forward");
    const committed = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-txn-forward"),
      requestedAt: "2026-08-11T00:00:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const record = (await harness.service.getSchemaAdmission(admissionId))!;
    harness.store.putAdmission({ ...record, state: "authorized", updatedAt: record.updatedAt });
    const prepared = harness.store.snapshot().preparedAdmissions.values().next().value;
    const handle = prepared
      ? { preparedId: prepared.preparedId, expiresAt: prepared.expiresAt }
      : { preparedId: preparedAdmissionId("prep-placeholder"), expiresAt: "2099-01-01T00:00:00Z" };

    const again = await harness.service.commitSchemaAdmission({
      context: authorizerContext(),
      admissionId,
      preparedHandle: handle,
    });
    expect(again.ok).toBe(true);
  });
});
