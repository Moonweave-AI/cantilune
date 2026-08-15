import { describe, expect, it } from "vitest";
import { CommsMessagingService } from "../../src/engine/commsMessagingService.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { idempotencyKey } from "@cantilune/core";
import { COMMS_LIMITS } from "../../src/foundation/commsLimits.js";
import { deliveryAttemptId, commsEventId } from "../../src/foundation/messageId.js";

describe("CommsMessagingService backpressure", () => {
  it("emits BackpressureApplied when outbox full", async () => {
    const [local] = LoopbackTransport.connectPair();
    const store = new MemoryCommsStore();
    const events: unknown[] = [];
    for (let i = 0; i < COMMS_LIMITS.maxInboxBacklog; i += 1) {
      const envelope = buildTestEnvelope({ messageId: `msg-bp-${i}` as never });
      store.appendOutbox({
        envelope,
        idempotencyKey: idempotencyKey(`idem-bp-${i}`),
        delivery: {
          deliveryId: deliveryAttemptId(`del-bp-${i}`),
          envelopeRef: envelope.messageId as string,
          envelopeDigest: envelope.integrityDigest,
          state: "queued",
          attempt: 0,
          createdAt: "2026-08-11T16:00:00Z",
        },
        event: {
          eventId: commsEventId(`evt-bp-${i}`),
          storeSequence: store.nextSequence(),
          kind: "MessageEnqueued",
          occurredAt: "2026-08-11T16:00:00Z",
          payload: {},
        },
      });
    }
    const service = new CommsMessagingService({
      store,
      transport: local,
      sessionAuthority: { isController: () => true, isMember: () => true },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: (e) => events.push(e) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const sent = await service.send(
      buildTestAuthContext(),
      buildTestEnvelope({ messageId: "msg-bp-overflow" as never }),
      idempotencyKey("idem-bp-overflow"),
    );
    expect(sent.ok).toBe(false);
    if (sent.ok) {
      return;
    }
    expect(sent.error.code).toBe("backpressure");
    expect(events.some((e) => (e as { kind: string }).kind === "BackpressureApplied")).toBe(true);
  });
});
