import { describe, expect, it } from "vitest";
import {
  correlationId,
  epochOrdinal,
  epochId,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  schemaAdmissionId,
  sessionId,
} from "@cantilune/core";
import {
  createAdmissionReceiptResolver,
  registerAdmissionReceipt,
} from "../../src/reconnect/admissionReceiptResolver.js";
import { descriptorRef } from "../../src/foundation/messageId.js";

describe("admissionReceiptResolver", () => {
  it("builds reconnect plan from admission receipt", () => {
    const resolver = createAdmissionReceiptResolver();
    const binding = {
      activationDomainId: "default" as never,
      bindingGeneration: 1 as never,
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      schemaRef: { schemaId: "default-v1", revisionId: "rev-001", digest: "abc" as never } as never,
      policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
      handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
      runtimeHead: "snap-E1" as never,
      admissionId: "adm-001" as never,
      activatedBy: "operator",
      activatedAt: "2026-08-11T15:00:00Z",
    };
    const receipt = {
      admissionId: schemaAdmissionId("adm-resolver-001"),
      activationDomainId: "default" as never,
      fromBinding: binding,
      toBinding: { ...binding, epochOrdinal: epochOrdinal(2) },
      beforeSnapshotRef: "snap-E0" as never,
      afterSnapshotRef: "snap-E1" as never,
      extensionPlanRef: "plan-ref",
      admissionTombstoneId: "tomb-001" as never,
      committedBy: "operator",
      committedAt: "2026-08-11T15:00:00Z",
      storeSequence: 1 as never,
      correlationId: correlationId("corr-resolver"),
      occurrenceId: occurrenceId("occ-resolver"),
      idempotencyKey: idempotencyKey("idem-resolver"),
      planDigest: "plan-digest" as never,
      authorizationEvidenceRef: "auth-evidence" as never,
    };
    const plan = resolver.buildReconnectPlan({
      receipt,
      sessionId: sessionId("session-resolver-001"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
      oldEndpointRef: descriptorRef("ep-old"),
      newEndpointRef: descriptorRef("ep-new"),
      authorizationRef: "auth-evidence",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.value.sessionId).toBe(sessionId("session-resolver-001"));
  });

  it("registerAdmissionReceipt is no-op for resolver without cache", async () => {
    const resolver = createAdmissionReceiptResolver();
    await expect(resolver.resolve("ref-1")).resolves.toBeUndefined();
    registerAdmissionReceipt(resolver, {} as never, "ref-1");
    await expect(resolver.resolve("ref-1")).resolves.toBeUndefined();
  });
});
