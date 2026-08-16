import { describe, expect, it } from "vitest";
import {
  bootstrapMeanSamples,
  cohenD,
  hedgesG,
  interpretCohenD,
  meanOf,
  mulberry32,
  pooledStdDev,
  quantile,
  sampleStdDev,
  sampleVariance,
  tukeyFences,
  withoutTukeyOutliers,
} from "../../src/analysis/descriptiveStats.js";

describe("descriptiveStats", () => {
  it("handles empty and singleton samples", () => {
    expect(meanOf([])).toBe(0);
    expect(sampleVariance([])).toBe(0);
    expect(sampleVariance([3])).toBe(0);
    expect(sampleStdDev([1, 3])).toBeCloseTo(Math.sqrt(2), 8);
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([4], 0.5)).toBe(4);
    expect(quantile([1, 2, 3], 0)).toBe(1);
    expect(quantile([1, 2, 3], 1)).toBe(3);
    expect(quantile([1, 2, 3], 0.5)).toBe(2);
  });

  it("applies Tukey fences and leaves small samples untouched", () => {
    const values = [1, 2, 3, 4, 100];
    const fences = tukeyFences(values);
    expect(fences.upper).toBeLessThan(100);
    expect(withoutTukeyOutliers(values)).toEqual([1, 2, 3, 4]);
    expect(withoutTukeyOutliers([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("reports Cohen/Hedges effect sizes and interpretations", () => {
    expect(cohenD([0, 0], [0, 0])).toBe(0);
    expect(hedgesG([1], [2])).toBe(0);
    const d = cohenD([0, 1, 2], [2, 3, 4]);
    expect(d).toBeGreaterThan(0);
    expect(hedgesG([0, 1, 2], [2, 3, 4])).toBeLessThan(d);
    expect(interpretCohenD(0.1)).toBe("negligible");
    expect(interpretCohenD(0.3)).toBe("small");
    expect(interpretCohenD(0.6)).toBe("medium");
    expect(interpretCohenD(0.9)).toBe("large");
    expect(pooledStdDev([1], [1])).toBe(0);
  });

  it("draws deterministic bootstrap means", () => {
    const first = mulberry32(7)();
    const second = mulberry32(7)();
    expect(first).toBe(second);
    expect(bootstrapMeanSamples([], 10, 1)).toEqual([]);
    const samples = bootstrapMeanSamples([1, 2, 3], 20, 99);
    expect(samples).toHaveLength(20);
    expect(samples.every((value) => value >= 1 && value <= 3)).toBe(true);
  });
});
