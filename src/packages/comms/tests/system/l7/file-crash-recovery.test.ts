import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  correlationId,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { MemoryCommsStore } from "../../../src/memory/memoryCommsStore.js";
import { createFileCommsStore } from "../../../src/file/fileCommsStore.js";
import {
  channelGeneration,
  channelId,
  messageId,
  registryVersion,
  wireVersion,
} from "../../../src/foundation/messageId.js";

describe("L7 file comms crash recovery", () => {
  it("recovers outbox after process restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-comms-crash-"));
    try {
      const memory = new MemoryCommsStore();
      const store = createFileCommsStore(dir, memory);
      store.appendOutbox({
        envelope: {
          wireVersion: wireVersion(1),
          registryVersion: registryVersion(1),
          messageId: messageId("msg-crash-001"),
          operationCode: "send",
          metadata: {
            epochId: "42" as never,
            epochOrdinal: 1 as never,
            operationTemplateRef: operationTemplateRef("send", "1"),
            sessionId: sessionId("session-crash-001"),
            correlationId: correlationId("corr-crash-001"),
            occurrenceId: occurrenceId("occ-crash-001"),
            idempotencyKey: idempotencyKey("idem-crash-001"),
          },
          sender: { actorId: "a1" as never, kind: "agent" },
          recipient: { actorId: "a2" as never, kind: "agent" },
          channelId: channelId("channel-crash-001"),
          channelGeneration: channelGeneration(1),
          sequence: 1,
          payload: {
            contentRef: "content://crash" as never,
            contentDigest: "digest" as never,
            mediaType: "application/json",
            byteLength: 4,
            classification: "internal",
          },
          ackMode: "durablyAccepted",
          issuedAt: "2026-08-11T16:00:00Z",
          expiresAt: "2026-08-11T17:00:00Z",
          integrityDigest: "integrity-crash-001",
        },
        idempotencyKey: idempotencyKey("idem-crash-001"),
        delivery: {
          deliveryId: "del-crash-001" as never,
          envelopeRef: "msg-crash-001",
          envelopeDigest: "integrity-crash-001",
          state: "queued",
          attempt: 0,
          createdAt: "2026-08-11T16:00:00Z",
        },
        event: {
          eventId: "evt-crash-001" as never,
          storeSequence: store.nextSequence(),
          kind: "MessageEnqueued",
          occurredAt: "2026-08-11T16:00:00Z",
          payload: { messageId: "msg-crash-001" },
        },
      });

      const restarted = createFileCommsStore(dir, new MemoryCommsStore());
      const snapshot = restarted.recover();
      expect(snapshot.outbox).toHaveLength(1);
      expect(restarted.getEnvelope(messageId("msg-crash-001"))?.messageId).toBe("msg-crash-001");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
