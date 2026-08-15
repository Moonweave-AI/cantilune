import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileCommsStore } from "../../src/file/fileCommsStore.js";
import { buildTestPeerDescriptor } from "../support/envelopeFixtures.js";
import { deliveryAttemptId, commsEventId } from "../../src/foundation/messageId.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { idempotencyKey } from "@cantilune/core";

describe("FileCommsStore operations", () => {
  it("persists inbox, reconnect, and dead letter records", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-file-ops-"));
    const store = createFileCommsStore(dir);
    const peer = buildTestPeerDescriptor({ descriptorRef: "desc-file-001" as never });
    store.putPeer(peer);
    const envelope = buildTestEnvelope({ messageId: "msg-file-inbox" as never });
    store.appendInbox({
      envelope,
      delivery: {
        deliveryId: deliveryAttemptId("in-file"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "received",
        attempt: 0,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-file-inbox"),
        storeSequence: store.nextSequence(),
        kind: "MessageReceived",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
      idempotencyKey: idempotencyKey("idem-file-inbox"),
    });
    store.putDeadLetter({
      deliveryId: deliveryAttemptId("dlq-file"),
      envelopeRef: "msg-file-inbox",
      reason: "test",
      quarantinedAt: "2026-08-11T16:00:00Z",
    });
    const reloaded = createFileCommsStore(dir);
    expect(reloaded.getPeer(peer.descriptorRef)).toBeDefined();
    expect(reloaded.snapshot().inbox).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("quarantines corrupt snapshot on load", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-file-corrupt-"));
    writeFileSync(join(dir, "comms.snapshot.json"), "{not-json", "utf8");
    expect(() => createFileCommsStore(dir)).toThrow(/corrupt or unreadable/);
    rmSync(dir, { recursive: true, force: true });
  });
});
