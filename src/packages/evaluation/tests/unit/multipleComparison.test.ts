import { describe, expect, it } from "vitest";
import { adjustPvalues, normalizeMultipleComparison } from "../../src/analysis/multipleComparison.js";

describe("multipleComparison", () => {
  it("normalizes method names", () => {
    expect(normalizeMultipleComparison("Holm-Bonferroni")).toBe("holm");
    expect(normalizeMultipleComparison("bonferroni")).toBe("bonferroni");
    expect(normalizeMultipleComparison("none")).toBe("none");
    expect(normalizeMultipleComparison("mystery")).toBe("none");
  });

  it("returns an empty adjustment for no tests", () => {
    expect(adjustPvalues([], "holm", 0.05)).toEqual([]);
  });

  it("leaves p-values unadjusted when method is none", () => {
    const rows = adjustPvalues([0.04, 0.2], "none", 0.05);
    expect(rows[0]).toMatchObject({ adjustedP: 0.04, rejected: true });
    expect(rows[1]).toMatchObject({ adjustedP: 0.2, rejected: false });
  });

  it("applies Bonferroni m-multiplication", () => {
    const rows = adjustPvalues([0.01, 0.04], "bonferroni", 0.05);
    expect(rows[0]?.adjustedP).toBeCloseTo(0.02, 8);
    expect(rows[1]?.adjustedP).toBeCloseTo(0.08, 8);
    expect(rows[1]?.rejected).toBe(false);
  });

  it("applies Holm 1979 step-down", () => {
    const rows = adjustPvalues([0.01, 0.04, 0.1], "holm", 0.05);
    expect(rows[0]?.rejected).toBe(true);
    expect(rows[2]?.rejected).toBe(false);
    expect(rows[0]?.adjustedP).toBeLessThanOrEqual(rows[1]?.adjustedP ?? 1);
  });
});
