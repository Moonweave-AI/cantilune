import { describe, expect, it } from "vitest";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { deliveryAttemptId, commsEventId, messageId } from "../../src/foundation/messageId.js";
import { idempotencyKey, contentRef } from "@cantilune/core";

describe("MemoryCommsStore", () => {
  it("appendOutbox and idempotency replay", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope();
    const delivery = {
      deliveryId: deliveryAttemptId("del-001"),
      envelopeRef: envelope.messageId as string,
      envelopeDigest: envelope.integrityDigest,
      state: "queued" as const,
      attempt: 0,
      createdAt: "2026-08-11T16:00:00Z",
    };
    const event = {
      eventId: commsEventId("evt-001"),
      storeSequence: store.nextSequence(),
      kind: "MessageEnqueued" as const,
      occurredAt: "2026-08-11T16:00:00Z",
      payload: { messageId: envelope.messageId as string },
    };
    const idem = idempotencyKey("idem-store-001");
    expect(store.appendOutbox({ envelope, idempotencyKey: idem, delivery, event })).toBe(
      "committed",
    );
    expect(store.appendOutbox({ envelope, idempotencyKey: idem, delivery, event })).toBe(
      "idempotent_replay",
    );
    expect(store.getEnvelope(envelope.messageId)).toBeDefined();
  });

  it("appendInbox with conflict detection", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-inbox-001" as never });
    const delivery = {
      deliveryId: deliveryAttemptId("in-001"),
      envelopeRef: envelope.messageId as string,
      envelopeDigest: envelope.integrityDigest,
      state: "received" as const,
      attempt: 0,
      createdAt: "2026-08-11T16:00:00Z",
    };
    const event = {
      eventId: commsEventId("evt-in-001"),
      storeSequence: store.nextSequence(),
      kind: "MessageReceived" as const,
      occurredAt: "2026-08-11T16:00:00Z",
      payload: { messageId: envelope.messageId as string },
    };
    const key = idempotencyKey("idem-inbox-001");
    expect(store.appendInbox({ envelope, delivery, event, idempotencyKey: key })).toBe("committed");
    const conflictEnvelope = buildTestEnvelope({
      messageId: "msg-inbox-conflict" as never,
      payload: {
        ...buildTestEnvelope().payload,
        contentRef: contentRef("content://conflict"),
      },
    });
    expect(
      store.appendInbox({
        envelope: conflictEnvelope,
        delivery: { ...delivery, envelopeRef: conflictEnvelope.messageId as string },
        event,
        idempotencyKey: key,
      }),
    ).toBe("conflict");
  });

  it("updateDelivery mutates outbox and inbox", () => {
    const store = new MemoryCommsStore();
    const envelope = buildTestEnvelope({ messageId: "msg-upd-001" as never });
    const delivery = {
      deliveryId: deliveryAttemptId("del-upd"),
      envelopeRef: envelope.messageId as string,
      envelopeDigest: envelope.integrityDigest,
      state: "queued" as const,
      attempt: 0,
      createdAt: "2026-08-11T16:00:00Z",
    };
    store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-upd"),
      delivery,
      event: {
        eventId: commsEventId("evt-upd"),
        storeSequence: store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: {},
      },
    });
    const updated = { ...delivery, state: "dispatched" as const, attempt: 1 };
    expect(store.updateDelivery(messageId(envelope.messageId as string), updated)).toBe(true);
    expect(store.getDelivery(messageId(envelope.messageId as string))?.state).toBe("dispatched");
  });

  it("readEvents filters by sequence", () => {
    const store = new MemoryCommsStore();
    store.appendEvent({
      eventId: commsEventId("evt-a"),
      storeSequence: 1 as never,
      kind: "MessageEnqueued",
      occurredAt: "2026-08-11T16:00:00Z",
      payload: {},
    });
    store.appendEvent({
      eventId: commsEventId("evt-b"),
      storeSequence: 2 as never,
      kind: "MessageEnqueued",
      occurredAt: "2026-08-11T16:00:00Z",
      payload: {},
    });
    expect(store.readEvents(1 as never)).toHaveLength(1);
  });

  it("claimIdempotency detects conflict", () => {
    const store = new MemoryCommsStore();
    const key = idempotencyKey("idem-claim");
    expect(store.claimIdempotency(key, "digest-a")).toBe("claimed");
    expect(store.claimIdempotency(key, "digest-a")).toBe("replay");
    expect(store.claimIdempotency(key, "digest-b")).toBe("conflict");
  });
});
