import { describe, expect, it } from "vitest";
import { OutboxDispatcher } from "../../src/recovery/outboxDispatcher.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { deliveryAttemptId, commsEventId } from "../../src/foundation/messageId.js";
import { idempotencyKey } from "@cantilune/core";
import { COMMS_LIMITS } from "../../src/foundation/commsLimits.js";

describe("OutboxDispatcher", () => {
  it("dispatches queued outbox deliveries", async () => {
    const [local] = LoopbackTransport.connectPair();
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-outbox-001" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-outbox"),
      delivery: {
        deliveryId: deliveryAttemptId("del-outbox"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: 0,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-outbox"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const dispatcher = new OutboxDispatcher({
      store,
      transport: local,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await dispatcher.dispatchPending();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.dispatched).toHaveLength(1);
  });

  it("marks dead letter after retry budget exhausted", async () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-dead-001" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-dead"),
      delivery: {
        deliveryId: deliveryAttemptId("del-dead"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: COMMS_LIMITS.maxRetryAttempts - 1,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-dead"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const dispatcher = new OutboxDispatcher({
      store,
      transport: {
        transportId: "failing",
        dispatch: async () => ({
          ok: false,
          error: { code: "transport_failed", phase: "send", message: "fail", retryable: true },
        }),
        receive: async () => ({
          ok: false,
          error: { code: "transport_failed", phase: "receive", message: "empty", retryable: true },
        }),
        handshake: async () => ({
          ok: false,
          error: { code: "transport_failed", phase: "session", message: "fail", retryable: false },
        }),
      },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await dispatcher.dispatchPending();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.failed).toHaveLength(1);
  });

  it("skips non-queued delivery states", async () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-skipped-001" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-skipped"),
      delivery: {
        deliveryId: deliveryAttemptId("del-skipped"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "dispatched",
        attempt: 1,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-skipped"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const dispatcher = new OutboxDispatcher({
      store,
      transport: new LoopbackTransport(),
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await dispatcher.dispatchPending();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.skipped).toHaveLength(1);
  });
});
