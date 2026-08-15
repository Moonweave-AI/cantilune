import { describe, expect, it } from "vitest";
import { parseCommunicationWireFrame } from "../../src/codec/parseCommunicationWire.js";

describe("L5 comms ingress wire negatives", () => {
  it("rejects unknown fields on wire frame", () => {
    const frame = new TextEncoder().encode(
      JSON.stringify({
        wireVersion: 1,
        registryVersion: 1,
        messageId: "msg-001",
        operationCode: "send",
        forged: true,
      }),
    );
    const decoded = parseCommunicationWireFrame(frame);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) {
      return;
    }
    expect(decoded.error.code).toBe("codec_invalid");
  });

  it("rejects unsupported wire version", () => {
    const frame = new TextEncoder().encode(JSON.stringify({ wireVersion: 99 }));
    const decoded = parseCommunicationWireFrame(frame);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) {
      return;
    }
    expect(decoded.error.code).toBe("wire_unsupported");
  });
});
