import { describe, expect, it } from "vitest";
import {
  encodeNetFrame,
  pushNetBytes,
  NET_FRAME_TYPE_ENVELOPE,
  NET_FRAME_TYPE_HANDSHAKE,
  type NetFrameParseState,
} from "../../src/transports/net/netFrame.js";

describe("netFrame", () => {
  it("round-trips an envelope frame", () => {
    const payload = new TextEncoder().encode("hello");
    const encoded = encodeNetFrame(NET_FRAME_TYPE_ENVELOPE, payload);
    const state: NetFrameParseState = { buffer: new Uint8Array() };
    const parsed = pushNetBytes(state, encoded, 1024);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]?.type).toBe(NET_FRAME_TYPE_ENVELOPE);
    expect(new TextDecoder().decode(parsed.value[0]!.payload)).toBe("hello");
    expect(state.buffer.byteLength).toBe(0);
  });

  it("holds a partial header and a split payload until complete", () => {
    const payload = new Uint8Array(8).fill(7);
    const encoded = encodeNetFrame(NET_FRAME_TYPE_HANDSHAKE, payload);
    const state: NetFrameParseState = { buffer: new Uint8Array() };
    const first = pushNetBytes(state, encoded.subarray(0, 3), 1024);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value).toHaveLength(0);
    }
    const second = pushNetBytes(state, encoded.subarray(3, 7), 1024);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value).toHaveLength(0);
    }
    const third = pushNetBytes(state, encoded.subarray(7), 1024);
    expect(third.ok).toBe(true);
    if (!third.ok) {
      return;
    }
    expect(third.value).toHaveLength(1);
    expect(third.value[0]?.type).toBe(NET_FRAME_TYPE_HANDSHAKE);
  });

  it("rejects an unknown frame type and an oversized length", () => {
    const state: NetFrameParseState = { buffer: new Uint8Array() };
    const unknown = pushNetBytes(state, Uint8Array.of(0x99, 0, 0, 0, 1, 0), 1024);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.message).toContain("unknown net frame type");
    }
    const oversizedState: NetFrameParseState = { buffer: new Uint8Array() };
    const header = Uint8Array.of(NET_FRAME_TYPE_ENVELOPE, 0, 0, 0, 50);
    const oversized = pushNetBytes(oversizedState, header, 8);
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.error.code).toBe("wire_oversized");
    }
  });
});
