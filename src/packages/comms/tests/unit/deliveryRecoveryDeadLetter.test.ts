import { describe, expect, it } from "vitest";
import { DeliveryRecovery } from "../../src/recovery/deliveryRecovery.js";
import { OutboxDispatcher } from "../../src/recovery/outboxDispatcher.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { deliveryAttemptId, commsEventId } from "../../src/foundation/messageId.js";
import { idempotencyKey } from "@cantilune/core";
import { COMMS_LIMITS } from "../../src/foundation/commsLimits.js";

describe("DeliveryRecovery dead letter path", () => {
  it("dead-letters failed dispatches and emits events", async () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-dlq-recover" as never });
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-dlq-recover"),
      delivery: {
        deliveryId: deliveryAttemptId("del-dlq-recover"),
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: COMMS_LIMITS.maxRetryAttempts - 1,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: commsEventId("evt-dlq-recover"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const outbox = new OutboxDispatcher({
      store,
      transport: {
        transportId: "fail",
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
    expect(report.value.deadLettered).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => (e as { kind: string }).kind === "MessageDeadLettered")).toBe(true);
  });
});
