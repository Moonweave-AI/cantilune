import { type Result, err, ok } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../../foundation/commsViolation.js";

export const NET_FRAME_TYPE_ENVELOPE = 0x01;
export const NET_FRAME_TYPE_HANDSHAKE = 0x02;
export const NET_FRAME_HEADER_BYTES = 5;

export type NetFrameType = typeof NET_FRAME_TYPE_ENVELOPE | typeof NET_FRAME_TYPE_HANDSHAKE;

export interface NetFrame {
  readonly type: NetFrameType;
  readonly payload: Uint8Array;
}

export interface NetFrameParseState {
  buffer: Uint8Array;
}

function isNetFrameType(value: number): value is NetFrameType {
  return value === NET_FRAME_TYPE_ENVELOPE || value === NET_FRAME_TYPE_HANDSHAKE;
}

function readU32Be(bytes: Uint8Array, offset: number): number {
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
}

export function encodeNetFrame(type: NetFrameType, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(NET_FRAME_HEADER_BYTES + payload.byteLength);
  out[0] = type;
  const length = payload.byteLength;
  out[1] = (length >>> 24) & 0xff;
  out[2] = (length >>> 16) & 0xff;
  out[3] = (length >>> 8) & 0xff;
  out[4] = length & 0xff;
  out.set(payload, NET_FRAME_HEADER_BYTES);
  return out;
}

function concatBuffers(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.byteLength + right.byteLength);
  out.set(left, 0);
  out.set(right, left.byteLength);
  return out;
}

/**
 * Incremental length-prefixed frame parser. Incomplete headers/payloads stay
 * in `state.buffer`; a length above `maxFrameBytes` fails closed.
 */
export function pushNetBytes(
  state: NetFrameParseState,
  chunk: Uint8Array,
  maxFrameBytes: number,
): Result<readonly NetFrame[], CommsViolation> {
  state.buffer = state.buffer.byteLength === 0 ? chunk.slice() : concatBuffers(state.buffer, chunk);
  const frames: NetFrame[] = [];
  while (state.buffer.byteLength >= NET_FRAME_HEADER_BYTES) {
    const typeByte = state.buffer[0] ?? 0;
    if (!isNetFrameType(typeByte)) {
      return err(
        commsViolation("codec_invalid", "ingress", "unknown net frame type", {
          retryable: false,
          actual: String(typeByte),
        }),
      );
    }
    const length = readU32Be(state.buffer, 1);
    if (length > maxFrameBytes) {
      return err(
        commsViolation("wire_oversized", "ingress", "net frame exceeds maxFrameBytes", {
          retryable: false,
        }),
      );
    }
    const total = NET_FRAME_HEADER_BYTES + length;
    if (state.buffer.byteLength < total) {
      break;
    }
    const payload = state.buffer.subarray(NET_FRAME_HEADER_BYTES, total).slice();
    state.buffer = state.buffer.subarray(total);
    frames.push({ type: typeByte, payload });
  }
  return ok(frames);
}
