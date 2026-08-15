import { describe, expect, it } from "vitest";
import {
  correlationId,
  epochId,
  epochOrdinal,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { createCommsReconnectService } from "../../src/reconnect/reconnectHandoff.js";
import { buildTestCommsServices } from "../support/envelopeFixtures.js";

describe("comms reconnect service", () => {
  it("throws when admission receipt absent", async () => {
    const service = createCommsReconnectService({ services: buildTestCommsServices() });
    await expect(
      service.instanceReconnect({
        handoff: {
          targetEpochId: epochId("43"),
          targetEpochOrdinal: epochOrdinal(2),
          operationTemplateRef: operationTemplateRef("introduce", "1"),
          sessionId: sessionId("session-legacy"),
          correlationId: correlationId("corr-legacy"),
          occurrenceId: occurrenceId("occ-legacy"),
        },
        peerDescriptorRef: "peer://worker-1",
      }),
    ).rejects.toThrow(/admission receipt required/);
  });
});
