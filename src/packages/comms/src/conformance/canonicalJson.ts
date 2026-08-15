const MAX_DEPTH = 32;

function canonicalizeJson(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    throw new Error("canonical encoding depth exceeded");
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJson(entry, depth + 1));
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = canonicalizeJson(record[key], depth + 1);
  }
  return out;
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalizeJson(value)));
}
