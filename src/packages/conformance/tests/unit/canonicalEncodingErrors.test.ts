import { describe, expect, it } from "vitest";
import { canonicalizeJson, canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";

describe("canonicalEncoding error branches", () => {
  it("rejects undefined, non-finite numbers, and exotic types", () => {
    expect(() => canonicalizeJson(undefined)).toThrow(/undefined/);
    expect(() => canonicalizeJson(Number.NaN)).toThrow(/non-finite/);
    expect(() => canonicalizeJson(1n)).toThrow(/bigint/);
    expect(() => canonicalizeJson(() => {})).toThrow(/function/);
    expect(() => canonicalizeJson(Symbol("x"))).toThrow(/symbol/);
    expect(() => canonicalizeJson(new Date())).toThrow(/Date/);
    expect(() => canonicalizeJson(new Map())).toThrow(/Map/);
    expect(() => canonicalizeJson(new Set())).toThrow(/Set/);
  });

  it("rejects non-plain objects and skips undefined object fields", () => {
    class Box {
      readonly x = 1;
    }
    expect(() => canonicalizeJson(new Box())).toThrow(/non-plain object/);
    expect(canonicalizeJson({ b: 1, a: 2, skip: undefined })).toEqual({ a: 2, b: 1 });
    expect(canonicalJsonBytes({ z: 1 }).length).toBeGreaterThan(0);
  });

  it("rejects depth beyond limit", () => {
    let value: unknown = { v: 0 };
    for (let i = 0; i < 40; i += 1) {
      value = { nested: value };
    }
    expect(() => canonicalizeJson(value)).toThrow(/depth exceeded/);
  });
});
