import { createHash } from "node:crypto";
import { contentDigest, type ContentDigest } from "@cantilune/core";

/** Deterministic JSON canonicalization for schema/policy digests. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function digestOfCanonical(value: unknown): ContentDigest {
  const bytes = canonicalJson(value);
  return contentDigest(createHash("sha256").update(bytes, "utf8").digest("hex"));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sorted[key] = sortValue(record[key]);
  }
  return sorted;
}
