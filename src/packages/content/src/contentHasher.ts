import { createHash } from "node:crypto";
import { contentRef, type ContentRef } from "@cantilune/core";
import type { ContentHasher } from "./contentStore.js";

const HEX_PATTERN = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();

/**
 * Create a SHA-256 content hasher.
 * Returned ContentRef format: "sha256:<64 hex chars>" (total 71 chars).
 *
 * Environment: requires Node.js (node:crypto). Not browser-compatible.
 */
export function createContentHasher(): ContentHasher {
  return (content: string | Uint8Array): ContentRef => {
    const bytes = content instanceof Uint8Array ? content : encoder.encode(content);
    const hex = createHash("sha256").update(bytes).digest("hex");
    return contentRef(`sha256:${hex}`);
  };
}

/**
 * Check whether a string is a valid SHA-256 ContentRef produced by this package.
 * Note: core's `contentRef()` accepts arbitrary strings — this only validates
 * the sha256:<hex64> format used by ContentStore.
 */
export function isSha256ContentRef(value: string): boolean {
  if (value.length !== 71) return false;
  if (!value.startsWith("sha256:")) return false;
  return HEX_PATTERN.test(value.slice(7));
}

/**
 * Extract the hex hash from a sha256 ContentRef.
 * Returns undefined if the ref is not in valid sha256 format.
 */
export function extractHex(ref: ContentRef): string | undefined {
  const raw = ref as string;
  if (!isSha256ContentRef(raw)) return undefined;
  return raw.slice(7);
}
