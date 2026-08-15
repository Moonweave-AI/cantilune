import { describe, expect, it } from "vitest";
import { buildTestCommsServices } from "../support/envelopeFixtures.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { idempotencyKey } from "@cantilune/core";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { sealVerifiedEnvelope } from "../../src/security/commsCapability.js";

describe("outbox dispatch integration", () => {
  it("drains queued outbox after manual enqueue", async () => {
    const [local] = LoopbackTransport.connectPair();
    const services = buildTestCommsServices({ transport: local });
    const envelope = buildTestEnvelope({ messageId: "msg-outbox-integ" as never });
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    services.store.appendOutbox({
      envelope,
      idempotencyKey: idempotencyKey("idem-outbox-integ"),
      delivery: {
        deliveryId: "del-outbox-integ" as never,
        envelopeRef: envelope.messageId as string,
        envelopeDigest: envelope.integrityDigest,
        state: "queued",
        attempt: 0,
        createdAt: "2026-08-11T16:00:00Z",
      },
      event: {
        eventId: "evt-outbox-integ" as never,
        storeSequence: services.store.nextSequence(),
        kind: "MessageEnqueued",
        occurredAt: "2026-08-11T16:00:00Z",
        payload: { messageId: envelope.messageId as string },
      },
    });
    await local.dispatch(verified);
    const dispatch = await services.recovery.outbox.dispatchPending();
    expect(dispatch.ok).toBe(true);
  });
});
