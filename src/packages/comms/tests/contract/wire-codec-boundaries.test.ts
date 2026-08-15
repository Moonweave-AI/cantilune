import { describe, expect, it } from "vitest";
import { parseCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import { COMMS_LIMITS } from "../../src/foundation/commsLimits.js";

describe("wire codec contract boundaries", () => {
  it("rejects unknown top-level frame keys", () => {
    const frame = new TextEncoder().encode(
      JSON.stringify({
        wireVersion: 1,
        registryVersion: 1,
        extra: true,
      }),
    );
    const decoded = parseCommunicationWireFrame(frame);
    expect(decoded.ok).toBe(false);
  });

  it("rejects invalid actor kind", () => {
    const frame = new TextEncoder().encode(
      JSON.stringify({
        wireVersion: 1,
        registryVersion: 1,
        messageId: "msg-1",
        operationCode: "send",
        metadata: {
          epochId: "42",
          epochOrdinal: 1,
          operationTemplateRef: { operationTypeId: "send", revision: "1" },
          sessionId: "session-1",
          correlationId: "corr-1",
          occurrenceId: "occ-1",
        },
        sender: { actorId: "a", kind: "invalid" },
        recipient: { actorId: "b", kind: "agent" },
        channelId: "ch-1",
        channelGeneration: 1,
        sequence: 1,
        payload: {
          contentRef: "c",
          contentDigest: "d",
          mediaType: "application/json",
          byteLength: 1,
          classification: "public",
        },
        ackMode: "durablyAccepted",
        issuedAt: "2026-08-11T16:00:00Z",
        expiresAt: "2099-01-01T00:00:00Z",
        integrityDigest: "deadbeef",
      }),
    );
    const decoded = parseCommunicationWireFrame(frame);
    expect(decoded.ok).toBe(false);
  });

  it("rejects frame exceeding max bytes", () => {
    const oversized = new Uint8Array(COMMS_LIMITS.maxFrameBytes + 1);
    expect(parseCommunicationWireFrame(oversized).ok).toBe(false);
  });
});
