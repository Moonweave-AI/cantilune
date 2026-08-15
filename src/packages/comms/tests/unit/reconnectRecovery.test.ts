import { describe, expect, it } from "vitest";
import { ReconnectRecovery } from "../../src/recovery/reconnectRecovery.js";
import { ReconnectCoordinator } from "../../src/reconnect/reconnectCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { testRuntimeCommitPort } from "../../src/engine/testRuntimeCommitPort.js";
import { createAdmissionReceiptResolver } from "../../src/reconnect/admissionReceiptResolver.js";
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
import { descriptorRef } from "../../src/foundation/messageId.js";

describe("ReconnectRecovery", () => {
  it("recovers peerAccepted reconnect records", async () => {
    const store = new MemoryCommsStore();
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
    const resolver = createAdmissionReceiptResolver();
    const planResult = resolver.buildReconnectPlan({
      receipt: {
        admissionId: schemaAdmissionId("adm-recovery-001"),
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
        correlationId: correlationId("corr-recovery"),
        occurrenceId: occurrenceId("occ-recovery"),
        idempotencyKey: idempotencyKey("idem-recovery"),
        planDigest: "pd" as never,
        authorizationEvidenceRef: "auth" as never,
      },
      sessionId: sessionId("session-recovery-001"),
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
      runtimeReceiptRef: "receipt",
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
    const events: unknown[] = [];
    const recovery = new ReconnectRecovery({
      store,
      coordinator,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    store.putReconnect({
      plan: planResult.value,
      state: "peerAccepted",
      updatedAt: "2026-08-11T16:00:00Z",
    });
    const report = await recovery.reconcile();
    expect(report.ok).toBe(true);
  });
});
