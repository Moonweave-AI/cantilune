import { describe, expect, it } from "vitest";
import { canonicalizeJson, canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomString(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789_-";
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += alphabet[randomInt(alphabet.length)]!;
  }
  return out;
}

function randomPrimitive(): unknown {
  const kind = randomInt(5);
  switch (kind) {
    case 0:
      return null;
    case 1:
      return randomInt(10_000);
    case 2:
      return Math.random() < 0.5;
    case 3:
      return randomString(randomInt(24) + 1);
    default:
      return randomString(randomInt(8));
  }
}

function randomValue(depth: number): unknown {
  if (depth <= 0) {
    return randomPrimitive();
  }
  const kind = randomInt(3);
  if (kind === 0) {
    return randomPrimitive();
  }
  if (kind === 1) {
    const length = randomInt(6);
    return Array.from({ length }, () => randomValue(depth - 1));
  }
  const keyCount = randomInt(6);
  const record: Record<string, unknown> = {};
  for (let index = 0; index < keyCount; index += 1) {
    record[randomString(randomInt(10) + 1)] = randomValue(depth - 1);
  }
  return record;
}

describe("canonical encoding fuzz", () => {
  it("canonicalizes random objects without throw", () => {
    for (let trial = 0; trial < 500; trial += 1) {
      const value = randomValue(4);
      expect(() => canonicalizeJson(value)).not.toThrow();
      expect(() => canonicalJsonBytes(value)).not.toThrow();
    }
  });

  it("is idempotent for random object graphs within depth budget", () => {
    for (let trial = 0; trial < 200; trial += 1) {
      const value = randomValue(3);
      const once = canonicalizeJson(value);
      const twice = canonicalizeJson(once);
      expect(twice).toEqual(once);
    }
  });
});
