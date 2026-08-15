import { describe, expect, it } from "vitest";
import { encodeA2AFrame, decodeA2AFrame } from "../../src/transports/a2a/a2aCodec.js";
import { assertA2AProfileCompatible } from "../../src/transports/a2a/a2aCompatibility.js";

describe("A2A codec contract", () => {
  it("round-trips pinned profile frames", () => {
    const body = new TextEncoder().encode('{"messageId":"msg-001"}');
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: 1, messageKind: "envelope" },
      body,
    );
    const decoded = decodeA2AFrame(frame);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }
    expect(decoded.value.header.profile).toBe("a2a/0.1");
    expect(new TextDecoder().decode(decoded.value.body)).toBe('{"messageId":"msg-001"}');
  });

  it("rejects unsupported A2A profile negotiation", () => {
    const result = assertA2AProfileCompatible("a2a/9.9");
    expect(result.ok).toBe(false);
  });
});
