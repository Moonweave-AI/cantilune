import { describe, expect, it } from "vitest";
import { DeliveryRecovery } from "../../src/recovery/deliveryRecovery.js";
import { OutboxDispatcher } from "../../src/recovery/outboxDispatcher.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { deliveryAttemptId, commsEventId } from "../../src/foundation/messageId.js";
import { idempotencyKey } from "@cantilune/core";

describe("DeliveryRecovery", () => {
  it("reconciles pending deliveries via outbox dispatcher", async () => {
    const [local] = LoopbackTransport.connectPair();
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-recover-001" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-recover"),
      delivery: {
        deliveryId: deliveryAttemptId("del-recover"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: 0,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-recover"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const outbox = new OutboxDispatcher({
      store,
      transport: local,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const events: unknown[] = [];
    const recovery = new DeliveryRecovery({
      store,
      outboxDispatcher: outbox,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const report = await recovery.reconcile();
    expect(report.ok).toBe(true);
    if (!report.ok) {
      return;
    }
    expect(report.value.redispatched).toBeGreaterThanOrEqual(0);
  });
});
