import { describe, expect, it } from "vitest";
import { decodeA2AFrame, encodeA2AFrame } from "../../src/transports/a2a/a2aCodec.js";

describe("a2aCodec decode", () => {
  it("round-trips A2A frame", () => {
    const body = new TextEncoder().encode("payload-bytes");
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: 1, messageKind: "envelope" },
      body,
    );
    const decoded = decodeA2AFrame(frame);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }
    expect(decoded.value.header.messageKind).toBe("envelope");
    expect(decoded.value.body).toEqual(body);
  });

  it("rejects missing separator", () => {
    const decoded = decodeA2AFrame(new TextEncoder().encode("no-separator"));
    expect(decoded.ok).toBe(false);
  });

  it("rejects unsupported profile", () => {
    const bad = new TextEncoder().encode(
      '{"profile":"other/9.9","wireVersion":1,"messageKind":"ack"}\x1ebody',
    );
    const decoded = decodeA2AFrame(bad);
    expect(decoded.ok).toBe(false);
  });
});
