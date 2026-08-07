import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok } from "../../../src/primitives/result.js";

describe("result", () => {
  it("constructs ok and err variants", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
    expect(err("failed")).toEqual({ ok: false, error: "failed" });
  });

  it("narrows with isOk and isErr", () => {
    const success = ok("value");
    const failure = err("reason");

    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    expect(isOk(failure)).toBe(false);
    expect(isErr(failure)).toBe(true);
  });
});
