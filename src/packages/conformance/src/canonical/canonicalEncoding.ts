const MAX_DEPTH = 32;
const MAX_KEYS = 10_000;

function rejectNonJsonValue(value: unknown, path: string): void {
  if (value === undefined) {
    throw new TypeError(`canonical encoding rejects undefined at ${path}`);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`canonical encoding rejects non-finite number at ${path}`);
    }
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new TypeError(`canonical encoding rejects ${typeof value} at ${path}`);
  }
  if (value instanceof Map || value instanceof Set || value instanceof Date) {
    throw new TypeError(`canonical encoding rejects ${value.constructor.name} at ${path}`);
  }
}

export function canonicalizeJson(value: unknown, depth = 0, path = "$"): unknown {
  rejectNonJsonValue(value, path);
  if (depth > MAX_DEPTH) {
    throw new Error("canonical encoding depth exceeded");
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalizeJson(entry, depth + 1, `${path}[${index}]`));
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(`canonical encoding rejects non-plain object at ${path}`);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  if (keys.length > MAX_KEYS) {
    throw new Error("canonical encoding key limit exceeded");
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) {
      continue;
    }
    const value = record[key];
    if (value === undefined) {
      continue;
    }
    out[key] = canonicalizeJson(value, depth + 1, `${path}.${key}`);
  }
  return out;
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  const canonical = canonicalizeJson(value);
  return Uint8Array.from(Buffer.from(JSON.stringify(canonical), "utf8"));
}
