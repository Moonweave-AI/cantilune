import { describe, expect, it } from "vitest";
import { ReconnectCoordinator } from "../../src/reconnect/reconnectCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { testRuntimeCommitPort } from "../../src/engine/testRuntimeCommitPort.js";
import {
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  schemaAdmissionId,
  sessionId,
} from "@cantilune/core";
import { createAdmissionReceiptResolver } from "../../src/reconnect/admissionReceiptResolver.js";
import { descriptorRef } from "../../src/foundation/messageId.js";

describe("ReconnectCoordinator", () => {
  it("rejects expired reconnect plan on propose", async () => {
    const resolver = createAdmissionReceiptResolver();
    const binding = {
      activationDomainId: "default" as never,
      bindingGeneration: 1 as never,
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      schemaRef: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
      policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
      handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
      runtimeHead: "snap" as never,
      admissionId: "adm" as never,
      activatedBy: "op",
      activatedAt: "2026-08-11T15:00:00Z",
    };
    const planResult = resolver.buildReconnectPlan({
      receipt: {
        admissionId: schemaAdmissionId("adm-rc-expired"),
        activationDomainId: "default" as never,
        fromBinding: binding,
        toBinding: binding,
        beforeSnapshotRef: "snap-0" as never,
        afterSnapshotRef: "snap-1" as never,
        extensionPlanRef: "plan",
        admissionTombstoneId: "tomb" as never,
        committedBy: "op",
        committedAt: "2026-08-11T15:00:00Z",
        storeSequence: 1 as never,
        correlationId: correlationId("corr-rc"),
        occurrenceId: occurrenceId("occ-rc"),
        idempotencyKey: idempotencyKey("idem-rc"),
        planDigest: "pd" as never,
        authorizationEvidenceRef: "auth" as never,
      },
      sessionId: sessionId("session-rc-expired"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
      oldEndpointRef: descriptorRef("ep-old"),
      newEndpointRef: descriptorRef("ep-new"),
      authorizationRef: "auth",
      expiresAt: "2020-01-01T00:00:00Z",
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    const coordinator = new ReconnectCoordinator({
      store: new MemoryCommsStore(),
      bindingResolver: { getActiveBinding: () => binding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const proposed = await coordinator.propose(planResult.value);
    expect(proposed.ok).toBe(false);
  });

  it("recover returns receipt for completed record", async () => {
    const store = new MemoryCommsStore();
    const resolver = createAdmissionReceiptResolver();
    const binding = {
      activationDomainId: "default" as never,
      bindingGeneration: 1 as never,
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      schemaRef: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
      policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
      handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
      runtimeHead: "snap" as never,
      admissionId: "adm" as never,
      activatedBy: "op",
      activatedAt: "2026-08-11T15:00:00Z",
    };
    const planResult = resolver.buildReconnectPlan({
      receipt: {
        admissionId: schemaAdmissionId("adm-rc-recover"),
        activationDomainId: "default" as never,
        fromBinding: binding,
        toBinding: binding,
        beforeSnapshotRef: "snap-0" as never,
        afterSnapshotRef: "snap-1" as never,
        extensionPlanRef: "plan",
        admissionTombstoneId: "tomb" as never,
        committedBy: "op",
        committedAt: "2026-08-11T15:00:00Z",
        storeSequence: 1 as never,
        correlationId: correlationId("corr-rc-recover"),
        occurrenceId: occurrenceId("occ-rc-recover"),
        idempotencyKey: idempotencyKey("idem-rc-recover"),
        planDigest: "pd" as never,
        authorizationEvidenceRef: "auth" as never,
      },
      sessionId: sessionId("session-rc-recover"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
      oldEndpointRef: descriptorRef("ep-old"),
      newEndpointRef: descriptorRef("ep-new"),
      authorizationRef: "auth",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    store.putReconnect({
      plan: planResult.value,
      state: "completed",
      runtimeReceiptRef: "receipt-ref",
      updatedAt: "2026-08-11T16:00:00Z",
    });
    const coordinator = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => binding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const recovered = await coordinator.recover(planResult.value.planId);
    expect(recovered.ok).toBe(true);
  });
});
