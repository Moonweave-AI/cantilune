import { describe, it, expect } from "vitest";
import { isSuiteFrozen, type BenchmarkSuite } from "../../src/benchmarks/benchmarkSuite.js";
import { benchmarkSuiteId } from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeSuite(overrides: Partial<BenchmarkSuite> = {}): BenchmarkSuite {
  return {
    suiteId: benchmarkSuiteId("s1"),
    suiteVersion: 1,
    name: "suite",
    description: "desc",
    claimRefs: [],
    caseManifestRefs: [],
    datasetRefs: [],
    coverageTaxonomy: [],
    requiredStrata: [],
    samplingPolicy: "census",
    defaultRunPolicy: "default",
    defaultScoringPolicy: "default",
    defaultBudgetPolicy: "default",
    provenanceRef: "prov",
    licenseRef: "license",
    privacyReviewRef: "privacy",
    suiteDigest: d("sd"),
    status: "frozen",
    frozenAt: "2026-01-01",
    supersedes: undefined,
    ...overrides,
  };
}

describe("Benchmark suite helpers", () => {
  it("detects frozen suite", () => {
    expect(isSuiteFrozen(makeSuite())).toBe(true);
  });

  it("rejects draft suite even with frozenAt", () => {
    expect(isSuiteFrozen(makeSuite({ status: "draft" }))).toBe(false);
  });

  it("rejects frozen status without frozenAt", () => {
    expect(isSuiteFrozen(makeSuite({ frozenAt: undefined }))).toBe(false);
  });
});
