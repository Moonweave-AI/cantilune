import { describe, it, expect } from "vitest";
import { ok, violations, violation } from "../../src/foundation/evaluationResult.js";

describe("EvaluationResult", () => {
  it("ok wraps a value", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("violations wraps violation array", () => {
    const v = violation("invalid_input", "test.path", "bad input");
    const result = violations<number>([v]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]!.code).toBe("invalid_input");
      expect(result.violations[0]!.path).toBe("test.path");
      expect(result.violations[0]!.message).toBe("bad input");
    }
  });

  it("violation includes context when provided", () => {
    const v = violation("budget_reserve_failed", "budget", "over limit", { max: 100 });
    expect(v.context).toEqual({ max: 100 });
  });

  it("violation omits context when undefined", () => {
    const v = violation("invalid_input", "field", "msg");
    expect(v.context).toBeUndefined();
  });
});
