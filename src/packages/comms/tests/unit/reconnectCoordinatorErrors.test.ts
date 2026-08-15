import { describe, expect, it } from "vitest";
import { ReconnectCoordinator } from "../../src/reconnect/reconnectCoordinator.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { createAdmissionReceiptResolver } from "../../src/reconnect/admissionReceiptResolver.js";
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
import { descriptorRef } from "../../src/foundation/messageId.js";

function buildPlan(_store: MemoryCommsStore) {
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
      admissionId: schemaAdmissionId("adm-rc-err"),
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
      correlationId: correlationId("corr-rc-err"),
      occurrenceId: occurrenceId("occ-rc-err"),
      idempotencyKey: idempotencyKey("idem-rc-err"),
      planDigest: "pd" as never,
      authorizationEvidenceRef: "auth" as never,
    },
    sessionId: sessionId("session-rc-err"),
    operationTemplateRef: operationTemplateRef("introduce", "1"),
    oldEndpointRef: descriptorRef("ep-old"),
    newEndpointRef: descriptorRef("ep-new"),
    authorizationRef: "auth",
    expiresAt: "2099-01-01T00:00:00Z",
  });
  expect(planResult.ok).toBe(true);
  if (!planResult.ok) {
    throw new Error("plan build failed");
  }
  return { binding, plan: planResult.value };
}

describe("ReconnectCoordinator errors", () => {
  it("rejects authorize when authorization missing", async () => {
    const store = new MemoryCommsStore();
    const { binding, plan } = buildPlan(store);
    const coordinator = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => binding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const proposed = await coordinator.propose(plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) {
      return;
    }
    const badRecord = {
      ...proposed.value,
      plan: { ...proposed.value.plan, authorizationRef: "" },
    };
    const authorized = await coordinator.authorize(badRecord);
    expect(authorized.ok).toBe(false);
  });

  it("rejects peerAccept on digest mismatch", async () => {
    const store = new MemoryCommsStore();
    const { binding, plan } = buildPlan(store);
    const coordinator = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => binding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const proposed = await coordinator.propose(plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) {
      return;
    }
    const authorized = await coordinator.authorize(proposed.value);
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) {
      return;
    }
    const accepted = await coordinator.peerAccept(authorized.value, "wrong-digest");
    expect(accepted.ok).toBe(false);
  });

  it("rejects runtimeCommit without session binding", async () => {
    const store = new MemoryCommsStore();
    const { binding, plan } = buildPlan(store);
    const coordinator = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => binding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const proposed = await coordinator.propose(plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) {
      return;
    }
    const authorized = await coordinator.authorize(proposed.value);
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) {
      return;
    }
    const accepted = await coordinator.peerAccept(authorized.value, plan.planDigest as string);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      return;
    }
    const committed = await coordinator.runtimeCommit(accepted.value);
    expect(committed.ok).toBe(false);
  });
});
