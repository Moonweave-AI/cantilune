import { describe, expect, it } from "vitest";
import { canonicalJsonBytes } from "../../src/conformance/canonicalJson.js";

describe("canonicalJson", () => {
  it("sorts object keys deterministically", () => {
    const a = canonicalJsonBytes({ z: 1, a: 2, m: { b: 1, a: 2 } });
    const b = canonicalJsonBytes({ a: 2, m: { a: 2, b: 1 }, z: 1 });
    expect(new TextDecoder().decode(a)).toBe(new TextDecoder().decode(b));
  });

  it("throws when depth exceeded", () => {
    let nested: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 40; i += 1) {
      nested = { child: nested };
    }
    expect(() => canonicalJsonBytes(nested)).toThrow(/depth exceeded/);
  });
});
