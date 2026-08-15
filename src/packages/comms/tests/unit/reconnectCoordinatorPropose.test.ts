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
import { channelGeneration, channelId, descriptorRef } from "../../src/foundation/messageId.js";
import { err } from "@cantilune/core";
import { commsViolation } from "../../src/foundation/commsViolation.js";

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
  return resolver.buildReconnectPlan({
    receipt: {
      admissionId: schemaAdmissionId("adm-rc-propose"),
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
      correlationId: correlationId("corr-rc-propose"),
      occurrenceId: occurrenceId("occ-rc-propose"),
      idempotencyKey: idempotencyKey("idem-rc-propose"),
      planDigest: "pd" as never,
      authorizationEvidenceRef: "auth" as never,
    },
    sessionId: sessionId("session-rc-propose"),
    operationTemplateRef: operationTemplateRef("introduce", "1"),
    oldEndpointRef: descriptorRef("ep-old"),
    newEndpointRef: descriptorRef("ep-new"),
    authorizationRef: "auth",
    expiresAt: "2099-01-01T00:00:00Z",
  });
}

describe("ReconnectCoordinator propose branches", () => {
  it("rejects expired plan", async () => {
    const store = new MemoryCommsStore();
    const planResult = buildPlan(store);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    const coord = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => planResult.value.toBinding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2099-01-01T00:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const expiredPlan = { ...planResult.value, expiresAt: "2020-01-01T00:00:00Z" };
    const result = await coord.propose(expiredPlan);
    expect(result.ok).toBe(false);
  });

  it("rejects plan digest mismatch", async () => {
    const store = new MemoryCommsStore();
    const planResult = buildPlan(store);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    const coord = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => planResult.value.toBinding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const badPlan = { ...planResult.value, planDigest: "wrong-digest" as never };
    const result = await coord.propose(badPlan);
    expect(result.ok).toBe(false);
  });

  it("rejects when target binding inactive", async () => {
    const store = new MemoryCommsStore();
    const planResult = buildPlan(store);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    const coord = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => undefined },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const result = await coord.propose(planResult.value);
    expect(result.ok).toBe(false);
  });

  it("rejects epoch mismatch", async () => {
    const store = new MemoryCommsStore();
    const planResult = buildPlan(store);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    const activeBinding = {
      ...planResult.value.toBinding,
      epochId: epochId("99"),
    };
    const coord = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => activeBinding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const result = await coord.propose(planResult.value);
    expect(result.ok).toBe(false);
  });

  it("rejects authorize from invalid state", async () => {
    const store = new MemoryCommsStore();
    const planResult = buildPlan(store);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    const coord = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => planResult.value.toBinding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const badRecord = {
      plan: planResult.value,
      state: "completed" as const,
      updatedAt: "2026-08-11T16:00:00Z",
    };
    const result = await coord.authorize(badRecord);
    expect(result.ok).toBe(false);
  });

  it("runtimeCommit failure marks recoveryRequired", async () => {
    const store = new MemoryCommsStore();
    const planResult = buildPlan(store);
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    const plan = planResult.value;
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
    const coord = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => plan.toBinding },
      runtimeCommit: {
        commitMessage: async () => ({ ok: true, value: { receiptRef: "r" } }),
        commitReconnect: async () =>
          err(commsViolation("runtime_commit_failed", "reconnect", "epoch commit failed")),
      },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const proposed = await coord.propose(plan);
    if (!proposed.ok) {
      throw new Error("expected propose ok");
    }
    const authorized = await coord.authorize(proposed.value);
    if (!authorized.ok) {
      throw new Error("expected authorize ok");
    }
    const accepted = await coord.peerAccept(authorized.value, plan.planDigest as string);
    if (!accepted.ok) {
      throw new Error("expected accept ok");
    }
    const committed = await coord.runtimeCommit(accepted.value);
    expect(committed.ok).toBe(false);
    expect(store.getReconnect(plan.planId)?.state).toBe("recoveryRequired");
  });
});
