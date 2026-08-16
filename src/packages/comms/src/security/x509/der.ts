/**
 * Minimal DER encoder for the ECDSA P-256 X.509 certificates issued by
 * `issueSelfSignedMtlsPair`. Not a general-purpose ASN.1 library.
 */

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) {
    total += part.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export function encodeDerLength(length: number): Uint8Array {
  if (length < 0) {
    throw new Error("DER length must be non-negative");
  }
  if (length < 128) {
    return Uint8Array.of(length);
  }
  if (length < 256) {
    return Uint8Array.of(0x81, length);
  }
  if (length < 65536) {
    return Uint8Array.of(0x82, (length >> 8) & 0xff, length & 0xff);
  }
  throw new Error("DER length exceeds 65535");
}

export function derTlv(tag: number, body: Uint8Array): Uint8Array {
  return concatBytes(Uint8Array.of(tag), encodeDerLength(body.byteLength), body);
}

export function derSeq(...parts: readonly Uint8Array[]): Uint8Array {
  return derTlv(0x30, concatBytes(...parts));
}

export function derSet(...parts: readonly Uint8Array[]): Uint8Array {
  return derTlv(0x31, concatBytes(...parts));
}

export function derOid(oid: string): Uint8Array {
  const arcs = oid.split(".").map((part) => Number(part));
  if (arcs.length < 2 || arcs.some((arc) => !Number.isInteger(arc) || arc < 0)) {
    throw new Error(`invalid OID: ${oid}`);
  }
  const first = 40 * (arcs[0] ?? 0) + (arcs[1] ?? 0);
  const out: number[] = [first];
  for (const arc of arcs.slice(2)) {
    out.push(...encodeBase128(arc));
  }
  return derTlv(0x06, Uint8Array.from(out));
}

function encodeBase128(value: number): number[] {
  if (value < 128) {
    return [value];
  }
  const bytes: number[] = [value & 0x7f];
  let rest = value >> 7;
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return bytes;
}

export function derIntegerBytes(bytes: Uint8Array): Uint8Array {
  let value = bytes;
  while (value.byteLength > 1 && value[0] === 0) {
    value = value.subarray(1);
  }
  if (value.byteLength === 0) {
    return derTlv(0x02, Uint8Array.of(0));
  }
  if ((value[0] ?? 0) >= 0x80) {
    const padded = new Uint8Array(value.byteLength + 1);
    padded.set(value, 1);
    return derTlv(0x02, padded);
  }
  return derTlv(0x02, value);
}

export function derIntegerNumber(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error("derIntegerNumber supports 0..255");
  }
  return derIntegerBytes(Uint8Array.of(value));
}

export function derBitString(bytes: Uint8Array, unusedBits = 0): Uint8Array {
  return derTlv(0x03, concatBytes(Uint8Array.of(unusedBits), bytes));
}

export function derOctetString(bytes: Uint8Array): Uint8Array {
  return derTlv(0x04, bytes);
}

export function derBool(value: boolean): Uint8Array {
  return derTlv(0x01, Uint8Array.of(value ? 0xff : 0x00));
}

export function derUtf8(value: string): Uint8Array {
  return derTlv(0x0c, new TextEncoder().encode(value));
}

export function derIa5(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function derUtcTime(date: Date): Uint8Array {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return derTlv(0x17, new TextEncoder().encode(`${yy}${mo}${dd}${hh}${mm}${ss}Z`));
}

export function derContextExplicit(tag: number, body: Uint8Array): Uint8Array {
  return derTlv(0xa0 | tag, body);
}

export function encodePem(label: string, der: Uint8Array): string {
  const b64 = Buffer.from(der).toString("base64");
  const lines = b64.match(/.{1,64}/g) ?? [""];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}
