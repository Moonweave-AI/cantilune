import { describe, expect, it } from "vitest";
import { idempotencyKey } from "@cantilune/core";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import {
  buildTestAuthContext,
  buildTestCommsServices,
  buildTestEnvelope,
} from "../support/envelopeFixtures.js";

describe("CommsMessagingService", () => {
  it("sends verified envelope through loopback transport", async () => {
    const [local, remote] = LoopbackTransport.connectPair();
    const services = buildTestCommsServices({ transport: local });
    const envelope = buildTestEnvelope({ messageId: "msg-send-001" as never });
    const sent = await services.messaging.send(
      buildTestAuthContext(),
      envelope,
      idempotencyKey("idem-send-001"),
    );
    expect(sent.ok).toBe(true);
    const received = await remote.receive();
    expect(received.ok).toBe(true);
  });

  it("rejects when E-Stop active", async () => {
    const services = buildTestCommsServices();
    services.admin.setFrozen(true);
    const sent = await services.messaging.send(
      buildTestAuthContext(),
      buildTestEnvelope(),
      idempotencyKey("idem-frozen"),
    );
    expect(sent.ok).toBe(false);
    if (sent.ok) {
      return;
    }
    expect(sent.error.code).toBe("comms_frozen");
  });
});
