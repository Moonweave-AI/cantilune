import { describe, expect, it } from "vitest";
import { buildTestCommsServices } from "../support/envelopeFixtures.js";
import { closeRecordId, channelGeneration, channelId } from "../../src/foundation/messageId.js";
import { sessionId } from "@cantilune/core";

describe("close session integration", () => {
  it("proposes and completes quiescent close", async () => {
    const services = buildTestCommsServices();
    const plan = {
      planId: closeRecordId("close-integ-001"),
      sessionId: sessionId("session-close-integ"),
      channelId: channelId("ch-close-integ"),
      channelGeneration: channelGeneration(1),
      sendBarrierApplied: true,
      pendingOutbox: 0,
      pendingInbox: 0,
      pendingInflight: 0,
      peerShutdownAckRef: "ack",
      authorizationRef: "auth",
      expiresAt: "2099-01-01T00:00:00Z",
    };
    const proposed = await services.close.propose(plan);
    expect(proposed.ok).toBe(true);
    const completed = await services.close.complete(plan);
    expect(completed.ok).toBe(true);
    expect(services.events.events.some((e) => e.kind === "SessionClosed")).toBe(true);
  });
});
