import { describe, it, expect } from "vitest";
import { isReportPublished } from "../../src/reports/evaluationReport.js";
import type { EvaluationReport } from "../../src/reports/evaluationReport.js";
import {
  reportId,
  evaluationClaimId,
  evaluationProtocolId,
  aggregateAnalysisId,
  benchmarkSuiteId,
} from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeReport(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    reportId: reportId("r1"),
    reportVersion: 1,
    claimRef: evaluationClaimId("c1"),
    protocolRef: evaluationProtocolId("p1"),
    suiteRef: benchmarkSuiteId("s1"),
    analysisRefs: [aggregateAnalysisId("a1")],
    candidateSubjectDigest: d("csd"),
    baselineSubjectDigests: [d("bsd")],
    evidenceRoot: d("er"),
    summary: {
      claimStatement: "test",
      decisionStatus: "supported",
      primaryEffectEstimate: 0.15,
      primaryConfidenceInterval: [0.05, 0.25],
      populationDescription: "all",
      sampleSize: 100,
      baselineDescription: "cursor",
    },
    metricRows: [],
    limitations: [],
    negativeResults: [],
    status: "published",
    publishedAt: "2026-02-01",
    supersedes: undefined,
    retractionReason: undefined,
    signatureRefs: ["sig-1"],
    reportDigest: d("rd"),
    ...overrides,
  };
}

describe("EvaluationReport", () => {
  it("is published when status is published with publishedAt", () => {
    expect(isReportPublished(makeReport())).toBe(true);
  });

  it("is not published when status is draft", () => {
    expect(isReportPublished(makeReport({ status: "draft" }))).toBe(false);
  });

  it("is not published when publishedAt is undefined", () => {
    expect(isReportPublished(makeReport({ publishedAt: undefined }))).toBe(false);
  });
});
