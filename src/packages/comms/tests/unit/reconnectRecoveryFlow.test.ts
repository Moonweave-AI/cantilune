import { describe, expect, it } from "vitest";
import { ReconnectCoordinator } from "../../src/reconnect/reconnectCoordinator.js";
import { ReconnectRecovery } from "../../src/recovery/reconnectRecovery.js";
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
import { channelGeneration, channelId, descriptorRef } from "../../src/foundation/messageId.js";

function buildCoordinator(store: MemoryCommsStore, binding: ReturnType<typeof buildBinding>) {
  return new ReconnectCoordinator({
    store,
    bindingResolver: { getActiveBinding: () => binding },
    runtimeCommit: testRuntimeCommitPort(),
    events: { emit: () => undefined },
    clock: { now: () => "2026-08-11T16:00:00Z" },
    eStop: { isFrozen: () => false, setFrozen: () => undefined },
  });
}

function buildBinding() {
  return {
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
}

function buildPlan(_store: MemoryCommsStore) {
  const binding = buildBinding();
  const resolver = createAdmissionReceiptResolver();
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
  if (!planResult.ok) {
    throw new Error("plan build failed");
  }
  return { binding, plan: planResult.value };
}

function registerBinding(store: MemoryCommsStore, plan: ReturnType<typeof buildPlan>["plan"]) {
  store.casSessionBinding({
    sessionId: plan.sessionId,
    expectedGeneration: channelGeneration(0),
    next: {
      sessionId: plan.sessionId,
      authoritativeSnapshotRef: plan.expectedRuntimeHead,
      localRuntimeInstanceId: "rt-local" as never,
      remoteRuntimeInstanceId: "rt-remote" as never,
      channelId: channelId("ch-rc"),
      channelGeneration: plan.expectedChannelGeneration,
      localEndpoint: plan.oldEndpointRef,
      remoteEndpoint: plan.newEndpointRef,
      negotiated: {
        wireVersion: 1 as never,
        transport: "loopback",
        codecRef: "comms/wire-v1",
        protocolVersion: "comms/1",
        a2aProfile: "a2a/0.1",
        features: [],
      },
      schemaEpochId: "42",
      status: "active",
      outboundSequence: 0,
      inboundSequence: 0,
      establishedAt: "2026-08-11T16:00:00Z",
      updatedAt: "2026-08-11T16:00:00Z",
    },
  });
}

describe("ReconnectCoordinator recover", () => {
  it("returns receipt for completed record", async () => {
    const store = new MemoryCommsStore();
    const { binding, plan } = buildPlan(store);
    const coordinator = buildCoordinator(store, binding);
    registerBinding(store, plan);
    const proposed = await coordinator.propose(plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) {
      return;
    }
    const authorized = await coordinator.authorize(proposed.value);
    if (!authorized.ok) {
      throw new Error("expected authorize ok");
    }
    const accepted = await coordinator.peerAccept(authorized.value, plan.planDigest as string);
    if (!accepted.ok) {
      throw new Error("expected accept ok");
    }
    const committed = await coordinator.runtimeCommit(accepted.value);
    expect(committed.ok).toBe(true);
    const recovered = await coordinator.recover(plan.planId);
    expect(recovered.ok).toBe(true);
  });

  it("recover fails for missing record", async () => {
    const store = new MemoryCommsStore();
    const coordinator = buildCoordinator(store, buildBinding());
    const result = await coordinator.recover("missing-plan" as never);
    expect(result.ok).toBe(false);
  });

  it("CAS failure marks recoveryRequired", async () => {
    const store = new MemoryCommsStore();
    const { binding, plan } = buildPlan(store);
    const coordinator = buildCoordinator(store, binding);
    registerBinding(store, plan);
    const proposed = await coordinator.propose(plan);
    if (!proposed.ok) {
      throw new Error("expected propose ok");
    }
    const authorized = await coordinator.authorize(proposed.value);
    if (!authorized.ok) {
      throw new Error("expected authorize ok");
    }
    const accepted = await coordinator.peerAccept(authorized.value, plan.planDigest as string);
    if (!accepted.ok) {
      throw new Error("expected accept ok");
    }
    const originalCas = store.casSessionBinding.bind(store);
    store.casSessionBinding = () => false;
    const committed = await coordinator.runtimeCommit(accepted.value);
    store.casSessionBinding = originalCas;
    expect(committed.ok).toBe(false);
    expect(store.getReconnect(plan.planId)?.state).toBe("recoveryRequired");
  });
});

describe("ReconnectRecovery", () => {
  it("reconciles peerAccepted reconnect records", async () => {
    const store = new MemoryCommsStore();
    const { binding, plan } = buildPlan(store);
    const coordinator = buildCoordinator(store, binding);
    registerBinding(store, plan);
    const proposed = await coordinator.propose(plan);
    if (!proposed.ok) {
      throw new Error("expected propose ok");
    }
    const authorized = await coordinator.authorize(proposed.value);
    if (!authorized.ok) {
      throw new Error("expected authorize ok");
    }
    const accepted = await coordinator.peerAccept(authorized.value, plan.planDigest as string);
    if (!accepted.ok) {
      throw new Error("expected accept ok");
    }
    store.putReconnect(accepted.value);
    const events: unknown[] = [];
    const recovery = new ReconnectRecovery({
      store,
      coordinator,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await recovery.reconcile();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.recovered).toHaveLength(1);
  });

  it("rejects when E-Stop active", async () => {
    const store = new MemoryCommsStore();
    const recovery = new ReconnectRecovery({
      store,
      coordinator: buildCoordinator(store, buildBinding()),
      eStop: { isFrozen: () => true, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await recovery.reconcile();
    expect(result.ok).toBe(false);
  });
});
