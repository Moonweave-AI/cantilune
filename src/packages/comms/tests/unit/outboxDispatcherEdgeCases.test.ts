import { describe, expect, it } from "vitest";
import { OutboxDispatcher } from "../../src/recovery/outboxDispatcher.js";
import { DeliveryRecovery } from "../../src/recovery/deliveryRecovery.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { deliveryAttemptId, commsEventId } from "../../src/foundation/messageId.js";
import { idempotencyKey } from "@cantilune/core";
import { COMMS_LIMITS } from "../../src/foundation/commsLimits.js";

describe("OutboxDispatcher edge cases", () => {
  it("fails when envelope missing from store", async () => {
    const store = new MemoryCommsStore();
    store.appendOutbox({
      envelope: buildTestEnvelope({ messageId: "msg-missing-env" as never }),
      idempotencyKey: idempotencyKey("idem-missing"),
      delivery: {
        deliveryId: deliveryAttemptId("del-missing"),
        envelopeRef: "msg-not-stored" as string,
        envelopeDigest: "digest",
        state: "queued",
        attempt: 0,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-missing"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const dispatcher = new OutboxDispatcher({
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
    const result = await dispatcher.dispatchPending();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.failed).toHaveLength(1);
  });

  it("rejects when E-Stop active", async () => {
    const dispatcher = new OutboxDispatcher({
      store: new MemoryCommsStore(),
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
      eStop: { isFrozen: () => true, setFrozen: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await dispatcher.dispatchPending();
    expect(result.ok).toBe(false);
  });

  it("marks retryWait on transport failure below budget", async () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-retry-wait" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-retry"),
      delivery: {
        deliveryId: deliveryAttemptId("del-retry"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: 0,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-retry"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const dispatcher = new OutboxDispatcher({
      store,
      transport: {
        transportId: "fail-once",
        dispatch: async () => ({
          ok: false,
          error: { code: "transport_failed", phase: "send", message: "temp fail", retryable: true },
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
    const delivery = store.getDelivery(envelope.messageId);
    expect(delivery?.state).toBe("retryWait");
    expect(delivery?.attempt).toBe(1);
    expect(COMMS_LIMITS.maxRetryAttempts).toBeGreaterThan(1);
  });
});

describe("DeliveryRecovery flow", () => {
  it("dead letters failed dispatches and emits events", async () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-dlr-flow" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-dlr"),
      delivery: {
        deliveryId: deliveryAttemptId("del-dlr"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: COMMS_LIMITS.maxRetryAttempts - 1,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-dlr"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const dispatcher = new OutboxDispatcher({
      store,
      transport: {
        transportId: "fail",
        dispatch: async () => ({
          ok: false,
          error: { code: "transport_failed", phase: "send", message: "permanent", retryable: true },
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
    const events: unknown[] = [];
    const recovery = new DeliveryRecovery({
      store,
      outboxDispatcher: dispatcher,
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await recovery.reconcile();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.deadLettered).toBeGreaterThan(0);
    expect(events.some((e) => (e as { kind: string }).kind === "MessageDeadLettered")).toBe(true);
  });
});
