import { describe, expect, it } from "vitest";
import {
  isReadOnlyViolation,
  readOnlyViolation,
} from "../../../src/foundation/readOnlyViolation.js";

describe("readOnlyViolation", () => {
  it("creates violations with and without path", () => {
    expect(readOnlyViolation("invalid_input", "msg")).toEqual({
      code: "invalid_input",
      message: "msg",
    });
    expect(readOnlyViolation("invalid_input", "msg", "field")).toEqual({
      code: "invalid_input",
      message: "msg",
      path: "field",
    });
  });

  it("type-guards read-only violations", () => {
    const violation = readOnlyViolation("derive_failed", "failed");
    expect(isReadOnlyViolation(violation)).toBe(true);
    expect(isReadOnlyViolation(new Error("nope"))).toBe(false);
    expect(isReadOnlyViolation(null)).toBe(false);
  });
});
