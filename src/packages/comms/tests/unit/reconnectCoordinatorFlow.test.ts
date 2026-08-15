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

describe("ReconnectCoordinator flow", () => {
  it("runs propose → authorize → peerAccept → runtimeCommit", async () => {
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
    const store = new MemoryCommsStore();
    const resolver = createAdmissionReceiptResolver();
    const sid = sessionId("session-rc-flow");
    const planResult = resolver.buildReconnectPlan({
      receipt: {
        admissionId: schemaAdmissionId("adm-rc-flow"),
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
        correlationId: correlationId("corr-rc-flow"),
        occurrenceId: occurrenceId("occ-rc-flow"),
        idempotencyKey: idempotencyKey("idem-rc-flow"),
        planDigest: "pd" as never,
        authorizationEvidenceRef: "auth" as never,
      },
      sessionId: sid,
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
    store.casSessionBinding({
      sessionId: sid,
      expectedGeneration: channelGeneration(0),
      next: {
        sessionId: sid,
        authoritativeSnapshotRef: "snap-1" as never,
        localRuntimeInstanceId: "rt-local" as never,
        remoteRuntimeInstanceId: "rt-remote" as never,
        channelId: channelId("ch-rc-flow"),
        channelGeneration: planResult.value.expectedChannelGeneration,
        localEndpoint: descriptorRef("ep-old"),
        remoteEndpoint: descriptorRef("ep-new"),
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
    const coordinator = new ReconnectCoordinator({
      store,
      bindingResolver: { getActiveBinding: () => binding },
      runtimeCommit: testRuntimeCommitPort(),
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
    });
    const proposed = await coordinator.propose(planResult.value);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) {
      return;
    }
    const authorized = await coordinator.authorize(proposed.value);
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) {
      return;
    }
    const accepted = await coordinator.peerAccept(
      authorized.value,
      planResult.value.planDigest as string,
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      return;
    }
    const committed = await coordinator.runtimeCommit(accepted.value);
    expect(committed.ok).toBe(true);
  });
});
