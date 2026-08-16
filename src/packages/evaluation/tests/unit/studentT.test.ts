import { describe, expect, it } from "vitest";
import {
  inverseNormalCdf,
  logGamma,
  regularizedIncompleteBeta,
  studentTCdf,
  studentTQuantile,
  twoSidedTPvalue,
  welchDegreesOfFreedom,
} from "../../src/analysis/studentT.js";

describe("studentT primitives", () => {
  it("matches the standard normal 0.975 quantile", () => {
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.959964, 4);
    expect(inverseNormalCdf(0.025)).toBeCloseTo(-1.959964, 4);
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 8);
  });

  it("covers Acklam tail branches", () => {
    expect(inverseNormalCdf(0.001)).toBeLessThan(-3);
    expect(inverseNormalCdf(0.999)).toBeGreaterThan(3);
    expect(inverseNormalCdf(0)).toBeLessThan(-8);
    expect(inverseNormalCdf(1)).toBeGreaterThan(8);
  });

  it("computes logGamma at known points", () => {
    expect(logGamma(1)).toBeCloseTo(0, 8);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 6);
    expect(logGamma(0.3)).toBeGreaterThan(logGamma(1));
    expect(() => logGamma(0)).toThrow(/z > 0/);
  });

  it("evaluates the regularized incomplete beta at the boundaries", () => {
    expect(regularizedIncompleteBeta(1, 1, 0)).toBe(0);
    expect(regularizedIncompleteBeta(1, 1, 1)).toBe(1);
    expect(regularizedIncompleteBeta(1, 1, 0.5)).toBeCloseTo(0.5, 6);
    expect(() => regularizedIncompleteBeta(0, 1, 0.5)).toThrow(/a > 0/);
  });

  it("evaluates the Student-t CDF and two-sided p-value", () => {
    expect(studentTCdf(0, 10)).toBeCloseTo(0.5, 8);
    expect(studentTCdf(1.96, 1000)).toBeCloseTo(0.975, 2);
    expect(studentTCdf(-1.96, 1000)).toBeCloseTo(0.025, 2);
    expect(studentTCdf(Number.POSITIVE_INFINITY, 5)).toBe(1);
    expect(studentTCdf(Number.NEGATIVE_INFINITY, 5)).toBe(0);
    expect(twoSidedTPvalue(0, 10)).toBeCloseTo(1, 6);
    expect(() => studentTCdf(0, 0)).toThrow(/degreesOfFreedom/);
  });

  it("returns exact t-quantiles for ν=1 and ν=2 and tabulated ν=10", () => {
    expect(studentTQuantile(0.5, 8)).toBe(0);
    expect(studentTQuantile(0.975, 1)).toBeCloseTo(12.7062047362, 4);
    expect(studentTQuantile(0.975, 2)).toBeCloseTo(4.30265272991, 4);
    expect(studentTQuantile(0.975, 10)).toBeCloseTo(2.22813885196, 3);
    expect(() => studentTQuantile(0.975, 0)).toThrow(/degreesOfFreedom/);
  });

  it("computes Welch–Satterthwaite degrees of freedom", () => {
    expect(welchDegreesOfFreedom(1, 10, 1, 10)).toBeGreaterThan(10);
    expect(welchDegreesOfFreedom(0, 2, 0, 2)).toBe(2);
  });
});
