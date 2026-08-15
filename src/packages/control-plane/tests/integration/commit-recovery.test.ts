import { describe, expect, it } from "vitest";
import { idempotencyKey, schemaAdmissionId, schemaRevisionId } from "@cantilune/core";
import { buildAdmissionHarness, createSchemaRevision } from "../support/buildAdmissionHarness.js";

describe("commit admission recovery", () => {
  it("returns the same receipt when commit is retried after finalize", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-recover-001"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T13:00:00Z",
    });
    harness.registerRevision(candidate);

    const admissionId = schemaAdmissionId("adm-recover-001");
    const first = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-recover-001"),
      requestedAt: "2026-08-11T13:00:00Z",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const recovered = await harness.service.recoverSchemaAdmissionCommit(admissionId);
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) {
      return;
    }
    expect(recovered.value.admissionId).toBe(admissionId);
    expect(recovered.value.toBinding.bindingGeneration).toBe(
      first.value.toBinding.bindingGeneration,
    );

    const decision = harness.store.getCommitDecision(admissionId);
    expect(decision?.status).toBe("finalized");
    expect(harness.store.getCommitReceipt(admissionId)?.admissionId).toBe(admissionId);
  });

  it("forward-recovers after simulated binding CAS drift", async () => {
    const harness = buildAdmissionHarness();
    const candidate = createSchemaRevision({
      schema: harness.genesisRevision.schema,
      revisionId: schemaRevisionId("rev-recover-002"),
      parentRef: harness.genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T13:05:00Z",
    });
    harness.registerRevision(candidate);

    const admissionId = schemaAdmissionId("adm-recover-002");
    const committed = await harness.runAdmissionPipeline({
      admissionId,
      candidate,
      idempotencyKey: idempotencyKey("idem-recover-002"),
      requestedAt: "2026-08-11T13:05:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }

    const receipt = committed.value;
    const priorDecision = harness.store.getCommitDecision(admissionId)!;
    harness.store.putCommitDecision({
      ...priorDecision,
      status: "recovery_required",
      updatedAt: "2026-08-11T13:06:00Z",
    });
    harness.store.casActiveBinding({
      domainId: receipt.activationDomainId,
      expectedGeneration: receipt.toBinding.bindingGeneration,
      nextBinding: receipt.fromBinding,
    });

    const recovered = await harness.service.recoverSchemaAdmissionCommit(admissionId);
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) {
      return;
    }
    expect(harness.store.getCommitDecision(admissionId)?.status).toBe("finalized");
    expect(harness.store.getActiveBinding(receipt.activationDomainId)?.bindingGeneration).toBe(
      receipt.toBinding.bindingGeneration,
    );
  });
});
