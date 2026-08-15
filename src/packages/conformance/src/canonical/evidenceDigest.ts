import { createHash } from "node:crypto";
import type { ContentDigest } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import { canonicalJsonBytes } from "./canonicalEncoding.js";

const HEX64 = /^[a-f0-9]{64}$/;

/** SHA-256 digest over canonical JSON encoding — not a brand cast. */
export function computeEvidenceDigest(value: unknown): ContentDigest {
  const bytes = canonicalJsonBytes(value);
  const hex = createHash("sha256").update(bytes).digest("hex");
  return contentDigest(hex);
}

export function isSha256HexDigest(value: string): boolean {
  return HEX64.test(value);
}

export function assertSha256HexDigest(value: string, path: string): void {
  if (!isSha256HexDigest(value)) {
    throw new Error(`expected sha256 hex digest at ${path}`);
  }
}
