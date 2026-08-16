/**
 * Property-style net frame round-trip: length-prefix integrity for random payloads.
 */
import { describe, expect, it } from "vitest";
import {
  encodeNetFrame,
  pushNetBytes,
  NET_FRAME_TYPE_ENVELOPE,
  NET_FRAME_TYPE_HANDSHAKE,
} from "../../src/transports/net/netFrame.js";

const MAX = 1 << 20;

describe("netFrame properties", () => {
  it("round-trips random payloads without loss", () => {
    for (let i = 0; i < 64; i += 1) {
      const len = (i * 17) % 2048;
      const payload = new Uint8Array(len);
      for (let j = 0; j < len; j += 1) {
        payload[j] = (i * 31 + j * 13) & 0xff;
      }
      const frame = encodeNetFrame(NET_FRAME_TYPE_ENVELOPE, payload);
      const state = { buffer: new Uint8Array(0) };
      const parsed = pushNetBytes(state, frame, MAX);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value).toHaveLength(1);
      expect(parsed.value[0]!.type).toBe(NET_FRAME_TYPE_ENVELOPE);
      expect(Buffer.from(parsed.value[0]!.payload).equals(Buffer.from(payload))).toBe(true);
    }
  });

  it("rejects truncated frames until complete", () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const frame = encodeNetFrame(NET_FRAME_TYPE_ENVELOPE, payload);
    const state = { buffer: new Uint8Array(0) };
    const first = pushNetBytes(state, frame.slice(0, 3), MAX);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value).toHaveLength(0);
    const rest = pushNetBytes(state, frame.slice(3), MAX);
    expect(rest.ok).toBe(true);
    if (!rest.ok) return;
    expect(rest.value).toHaveLength(1);
    expect(Buffer.from(rest.value[0]!.payload).equals(Buffer.from(payload))).toBe(true);
  });

  it("reassembles frames from arbitrary partitions", () => {
    const payload = new Uint8Array(64);
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] = (i * 19) & 0xff;
    }
    const frame = encodeNetFrame(NET_FRAME_TYPE_ENVELOPE, payload);
    for (const cut of [1, 4, 5, 9, frame.length - 1]) {
      const state = { buffer: new Uint8Array(0) };
      const head = pushNetBytes(state, frame.subarray(0, cut), MAX);
      expect(head.ok).toBe(true);
      if (!head.ok) return;
      expect(head.value).toHaveLength(0);
      const tail = pushNetBytes(state, frame.subarray(cut), MAX);
      expect(tail.ok).toBe(true);
      if (!tail.ok) return;
      expect(tail.value).toHaveLength(1);
      expect(Buffer.from(tail.value[0]!.payload).equals(Buffer.from(payload))).toBe(true);
    }
  });

  it("emits duplicate frames independently (no silent frame-layer dedup)", () => {
    const payload = new Uint8Array([7, 7, 7]);
    const frame = encodeNetFrame(NET_FRAME_TYPE_ENVELOPE, payload);
    const doubled = new Uint8Array(frame.length * 2);
    doubled.set(frame, 0);
    doubled.set(frame, frame.length);
    const parsed = pushNetBytes({ buffer: new Uint8Array(0) }, doubled, MAX);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toHaveLength(2);
    expect(Buffer.from(parsed.value[0]!.payload).equals(Buffer.from(payload))).toBe(true);
    expect(Buffer.from(parsed.value[1]!.payload).equals(Buffer.from(payload))).toBe(true);
  });

  it("preserves arrival order when frames are reordered on the wire", () => {
    const first = encodeNetFrame(NET_FRAME_TYPE_ENVELOPE, Uint8Array.of(1));
    const second = encodeNetFrame(NET_FRAME_TYPE_HANDSHAKE, Uint8Array.of(2));
    const reversed = new Uint8Array(first.length + second.length);
    reversed.set(second, 0);
    reversed.set(first, second.length);
    const parsed = pushNetBytes({ buffer: new Uint8Array(0) }, reversed, MAX);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.map((frame) => frame.type)).toEqual([
      NET_FRAME_TYPE_HANDSHAKE,
      NET_FRAME_TYPE_ENVELOPE,
    ]);
    expect(parsed.value[0]!.payload[0]).toBe(2);
    expect(parsed.value[1]!.payload[0]).toBe(1);
  });

  it("does not reconstruct a payload from truncated or byte-shuffled leftovers", () => {
    const payload = new Uint8Array([10, 20, 30, 40]);
    const frame = encodeNetFrame(NET_FRAME_TYPE_ENVELOPE, payload);
    for (let cut = 0; cut < frame.length; cut += 1) {
      const truncated = pushNetBytes({ buffer: new Uint8Array(0) }, frame.subarray(0, cut), MAX);
      expect(truncated.ok).toBe(true);
      if (!truncated.ok) return;
      expect(truncated.value).toHaveLength(0);
    }
    const shuffled = Uint8Array.from(frame);
    const type = shuffled[0]!;
    shuffled[0] = shuffled[shuffled.length - 1]!;
    shuffled[shuffled.length - 1] = type;
    const reordered = pushNetBytes({ buffer: new Uint8Array(0) }, shuffled, MAX);
    if (reordered.ok) {
      const recovered = reordered.value[0];
      if (recovered !== undefined) {
        expect(Buffer.from(recovered.payload).equals(Buffer.from(payload))).toBe(false);
      }
    }
  });
});
