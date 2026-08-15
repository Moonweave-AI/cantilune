import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../../foundation/commsViolation.js";
import { A2A_PROFILE_PINNED } from "../../foundation/commsLimits.js";

export interface A2AFrameHeader {
  readonly profile: typeof A2A_PROFILE_PINNED;
  readonly wireVersion: number;
  readonly messageKind: "envelope" | "handshake" | "ack";
}

export function encodeA2AFrame(header: A2AFrameHeader, body: Uint8Array): Uint8Array {
  const prefix = JSON.stringify(header);
  const prefixBytes = new TextEncoder().encode(prefix);
  const out = new Uint8Array(prefixBytes.length + 1 + body.length);
  out.set(prefixBytes, 0);
  out[prefixBytes.length] = 0x1e;
  out.set(body, prefixBytes.length + 1);
  return out;
}

export function decodeA2AFrame(
  bytes: Uint8Array,
): Result<{ header: A2AFrameHeader; body: Uint8Array }, CommsViolation> {
  const sep = bytes.indexOf(0x1e);
  if (sep < 0) {
    return err(commsViolation("codec_invalid", "ingress", "missing A2A frame separator"));
  }
  const headerText = new TextDecoder().decode(bytes.subarray(0, sep));
  try {
    const header = JSON.parse(headerText) as A2AFrameHeader;
    if (header.profile !== A2A_PROFILE_PINNED) {
      return err(commsViolation("protocol_incompatible", "negotiate", "unsupported A2A profile"));
    }
    return ok({ header, body: bytes.subarray(sep + 1) });
  } catch {
    return err(commsViolation("codec_invalid", "ingress", "invalid A2A header JSON"));
  }
}
