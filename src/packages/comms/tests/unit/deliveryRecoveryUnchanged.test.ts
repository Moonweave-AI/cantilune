import { describe, expect, it } from "vitest";
import { DeliveryRecovery } from "../../src/recovery/deliveryRecovery.js";
import { OutboxDispatcher } from "../../src/recovery/outboxDispatcher.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { deliveryAttemptId, commsEventId } from "../../src/foundation/messageId.js";
import { idempotencyKey } from "@cantilune/core";

function makeRecovery(store: MemoryCommsStore) {
  const outbox = new OutboxDispatcher({
    store,
    transport: {
      transportId: "noop",
      dispatch: async () => ({ ok: true, value: { attemptRef: "a" } }),
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
  return new DeliveryRecovery({
    store,
    outboxDispatcher: outbox,
    eStop: { isFrozen: () => false, setFrozen: () => undefined },
    events: { emit: () => undefined },
    clock: { now: () => "2026-08-11T16:00:00Z" },
  });
}

describe("DeliveryRecovery unchanged branches", () => {
  it("counts acknowledged and deadLettered as unchanged", async () => {
    const store = new MemoryCommsStore();
    for (const [messageId, state] of [
      ["msg-ack", "acknowledged"],
      ["msg-dead", "deadLettered"],
    ] as const) {
      const envelope = buildTestEnvelope({ messageId: messageId as never });
      store.appendOutbox({
        envelope,
        idempotencyKey: idempotencyKey(`idem-${messageId}`),
        delivery: {
          deliveryId: deliveryAttemptId(`del-${messageId}`),
          envelopeRef: envelope.messageId as string,
          envelopeDigest: envelope.integrityDigest,
          state,
          attempt: 1,
          createdAt: "2026-08-11T16:00:00Z",
          ...(state === "acknowledged"
            ? { ackAt: "2026-08-11T16:01:00Z" }
            : { terminalAt: "2026-08-11T16:01:00Z" }),
        },
        event: {
          eventId: commsEventId(`evt-${messageId}`),
          storeSequence: store.nextSequence(),
          kind: "MessageEnqueued",
          occurredAt: "2026-08-11T16:00:00Z",
          payload: {},
        },
      });
      if (state !== "acknowledged") {
        store.updateDelivery(envelope.messageId, {
          ...store.getDelivery(envelope.messageId)!,
          state: "deadLettered",
        });
      }
    }
    const envelope = buildTestEnvelope({ messageId: "msg-disp-ack" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-disp-ack"),
      delivery: {
        deliveryId: deliveryAttemptId("del-disp-ack"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "dispatched",
        attempt: 1,
        createdAt: "2026-08-11T16:00:00Z",
        ackAt: "2026-08-11T16:01:00Z",
      },
      event: {
        eventId: commsEventId("evt-disp-ack"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    store.updateDelivery(envelope.messageId, {
      ...store.getDelivery(envelope.messageId)!,
      state: "dispatched",
      ackAt: "2026-08-11T16:01:00Z",
    });

    const report = await makeRecovery(store).reconcile();
    expect(report.ok).toBe(true);
    if (!report.ok) {
      return;
    }
    expect(report.value.unchanged).toBe(3);
  });

  it("rejects when E-Stop active", async () => {
    const recovery = new DeliveryRecovery({
      store: new MemoryCommsStore(),
      outboxDispatcher: new OutboxDispatcher({
        store: new MemoryCommsStore(),
        transport: {
          transportId: "noop",
          dispatch: async () => ({ ok: true, value: { attemptRef: "a" } }),
          receive: async () => ({
            ok: false,
            error: {
              code: "transport_failed",
              phase: "receive",
              message: "empty",
              retryable: true,
            },
          }),
          handshake: async () => ({
            ok: false,
            error: {
              code: "transport_failed",
              phase: "session",
              message: "fail",
              retryable: false,
            },
          }),
        },
        eStop: { isFrozen: () => false, setFrozen: () => undefined },
        clock: { now: () => "2026-08-11T16:00:00Z" },
      }),
      eStop: { isFrozen: () => true, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await recovery.reconcile();
    expect(result.ok).toBe(false);
  });
});
