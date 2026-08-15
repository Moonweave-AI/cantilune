import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileCommsStore } from "../../src/file/fileCommsStore.js";
import { buildTestEnvelope, buildTestPeerDescriptor } from "../support/envelopeFixtures.js";
import {
  closeRecordId,
  channelGeneration,
  channelId,
  commsEventId,
  deliveryAttemptId,
  descriptorRef,
  messageId,
  reconnectRecordId,
} from "../../src/foundation/messageId.js";
import {
  contentRef,
  correlationId,
  epochId,
  epochOrdinal,
  evidenceId,
  evidenceRef,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  planDigest,
  sessionId,
} from "@cantilune/core";

describe("FileCommsStore full API", () => {
  it("exercises durable store surface", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-file-full-"));
    const store = new FileCommsStore({ dir });
    const peer = buildTestPeerDescriptor();
    store.putPeer(peer);
    const sid = sessionId("session-file-full");
    store.putHandshake({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: descriptorRef("ep-hs"),
      transcriptDigest: "digest",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-hs"),
        occurrenceId: occurrenceId("occ-hs"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    store.casSessionBindingDurable({
      sessionId: sid,
      expectedGeneration: channelGeneration(0),
      next: {
        sessionId: sid,
        authoritativeSnapshotRef: "snap-1" as never,
        localRuntimeInstanceId: "rt-local" as never,
        remoteRuntimeInstanceId: "rt-remote" as never,
        channelId: channelId("ch-file"),
        channelGeneration: channelGeneration(1),
        localEndpoint: descriptorRef("ep-local"),
        remoteEndpoint: descriptorRef("ep-remote"),
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
    const envelope = buildTestEnvelope({ messageId: "msg-file-full" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-file-full"),
      delivery: {
        deliveryId: deliveryAttemptId("del-file-full"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: 0,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-file-full"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    store.updateDelivery(messageId(envelope.messageId as string), {
      deliveryId: deliveryAttemptId("del-file-full"),
      envelopeRef: envelope.messageId as string,
      envelopeDigest: envelope.integrityDigest,
      state: "dispatched",
      attempt: 1,
      createdAt: "2026-08-11T16:00:00Z",
    });
    store.putAck({
      messageId: messageId(envelope.messageId as string),
      sessionId: sid,
      channelId: channelId("ch-file"),
      channelGeneration: channelGeneration(1),
      sequence: 1,
      envelopeDigest: envelope.integrityDigest,
      peerInstanceId: "rt-remote" as never,
      level: "durablyAccepted",
      status: "accepted",
      receivedAt: "2026-08-11T16:00:00Z",
      integrityDigest: envelope.integrityDigest,
    });
    const planId = reconnectRecordId("rc-file-full");
    store.putReconnect({
      plan: {
        planId,
        admissionReceipt: {} as never,
        admissionReceiptDigest: "digest" as never,
        fromBinding: {} as never,
        toBinding: {} as never,
        metadata: {
          epochId: epochId("42"),
          epochOrdinal: epochOrdinal(1),
          operationTemplateRef: operationTemplateRef("reconnect", "1"),
          sessionId: sid,
          correlationId: correlationId("corr-rc"),
          occurrenceId: occurrenceId("occ-rc"),
        },
        sessionId: sid,
        operationTemplateRef: operationTemplateRef("reconnect", "1"),
        oldEndpointRef: descriptorRef("ep-old"),
        newEndpointRef: descriptorRef("ep-new"),
        expectedChannelGeneration: channelGeneration(1),
        expectedRuntimeHead: "snap-1" as never,
        authorizationRef: "auth",
        expiresAt: "2099-01-01T00:00:00Z",
        planDigest: planDigest("plan-digest"),
      },
      state: "proposed",
      updatedAt: "2026-08-11T16:00:00Z",
    });
    expect(store.getReconnect(planId)).toBeDefined();
    store.putClosePlan({
      planId: closeRecordId("close-file"),
      sessionId: sid,
      channelId: channelId("ch-file"),
      channelGeneration: channelGeneration(1),
      sendBarrierApplied: true,
      pendingOutbox: 0,
      pendingInbox: 0,
      pendingInflight: 0,
      authorizationRef: "auth",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    store.putForceClose({
      planId: closeRecordId("force-file"),
      sessionId: sid,
      operatorRef: "operator",
      reason: "test",
      forcedAt: "2026-08-11T16:00:00Z",
    });
    expect(store.getForceClose(closeRecordId("force-file"))).toBeDefined();
    store.putDelegation({
      oldEndpointRef: descriptorRef("ep-old"),
      newEndpointRef: descriptorRef("ep-new"),
      oldChannelId: channelId("ch-old"),
      newChannelId: channelId("ch-new"),
      channelGeneration: channelGeneration(2),
      delegator: peer.actors[0]!,
      delegatee: peer.actors[0]!,
      authorizationRef: evidenceRef(evidenceId("auth"), "approval", contentRef("content://auth")),
      oneTimeCapabilityRef: evidenceRef(evidenceId("cap"), "approval", contentRef("content://cap")),
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("delegate", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-del"),
        occurrenceId: occurrenceId("occ-del"),
      },
      planDigest: "delegation-digest",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    store.putDelegationReceipt({
      planDigest: "delegation-digest",
      peerAckDigest: "delegation-digest",
      delegatedAt: "2026-08-11T16:00:00Z",
      oldEndpointTombstoneRef: "tombstone://ep-old",
    });
    store.appendJournal({ kind: "test-entry" });
    expect(store.loadJournal()).toHaveLength(1);
    store.persist();
    store.recover();
    expect(store.claimIdempotency(idempotencyKey("idem-claim-file"), "digest-a")).toBe("claimed");
    rmSync(dir, { recursive: true, force: true });
  });
});
