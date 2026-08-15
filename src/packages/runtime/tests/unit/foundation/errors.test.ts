import { describe, expect, it } from "vitest";
import { RuntimeError, runtimeViolation, throwRuntime } from "../../../src/foundation/errors.js";

describe("runtime errors", () => {
  it("wraps violations in RuntimeError", () => {
    const violation = runtimeViolation("admission_rejected", "not allowed");
    const error = new RuntimeError(violation);
    expect(error.violation.code).toBe("admission_rejected");
    expect(error.message).toBe("not allowed");
  });

  it("throws via throwRuntime", () => {
    expect(() => throwRuntime(runtimeViolation("replay_mismatch", "terminal mismatch"))).toThrow(
      RuntimeError,
    );
  });
});
