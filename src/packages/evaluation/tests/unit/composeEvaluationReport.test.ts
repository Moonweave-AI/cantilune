import { describe, expect, it } from "vitest";
import { analyzeMetricObservations } from "../../src/analysis/analyzeMetricObservations.js";
import { composeEvaluationReport } from "../../src/reports/composeEvaluationReport.js";
import { isReportPublished } from "../../src/reports/evaluationReport.js";
import { evaluationRunPlanId } from "../../src/foundation/evaluationIds.js";
import { makeObservation } from "../support/makeObservation.js";
import type { EvaluationClaim, EvaluationProtocol } from "../../src/claims/evaluationClaim.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function claim(): EvaluationClaim {
  return {
    claimId: "c1" as EvaluationClaim["claimId"],
    claimVersion: 1,
    claimCode: "evaluation.c1",
    statement: "expressiveness",
    nullHypothesis: "no difference",
    targetPopulation: "all",
    candidateSubjectPolicy: "c9",
    baselineFamily: "cursor",
    primaryMetricRefs: [],
    secondaryMetricRefs: [],
    guardrailMetricRefs: [],
    successRule: "CI excludes 0",
    failureRule: "CI includes 0",
    inconclusiveRule: "n<2",
    samplePlanRef: "sp",
    uncertaintyMethod: "student-t",
    multipleComparisonPolicy: "holm",
    stoppingRule: "one-look",
    rescopeOrTerminationRule: "rfc-0001",
    ownerRef: "owner",
    requiredReviewerRoles: ["stats"],
    status: "protocolFrozen",
    protocolDigest: d("pd"),
    createdAt: "2026-01-01",
    frozenAt: "2026-01-02",
    supersedes: undefined,
  };
}

function protocol(): EvaluationProtocol {
  return {
    protocolId: "p1" as EvaluationProtocol["protocolId"],
    protocolVersion: 1,
    claimRefs: [claim().claimId],
    benchmarkSuiteRef: "suite-1",
    candidateSelection: "c9",
    baselineSelection: "pin",
    populationDefinition: "all",
    samplingMethod: "census",
    sampleSize: 2,
    seedPolicy: "fixed",
    repetitionPolicy: "1x",
    randomizationPlan: "none",
    blindingPlan: "none",
    metricPlan: "primary",
    analysisPlan: "preregistered",
    missingDataPolicy: "exclude",
    outlierPolicy: "none",
    stoppingPolicy: "one-look",
    securityPlanRef: "sec",
    privacyPlanRef: "priv",
    budgetPolicyRef: "budget",
    reviewPolicyRef: "review",
    amendmentOf: undefined,
    protocolDigest: d("proto"),
    frozenAt: "2026-01-02",
  };
}

describe("composeEvaluationReport", () => {
  it("emits a draft report that cannot be treated as published support", () => {
    const analysis = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      exploratory: true,
      observations: [
        makeObservation({ rawValue: 1, normalizedValue: 1 }),
        makeObservation({ observationId: "o2" as never, rawValue: 1, normalizedValue: 1 }),
      ],
    });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    const report = composeEvaluationReport({
      claim: claim(),
      protocol: protocol(),
      analysis: analysis.value,
      candidateSubjectDigest: d("cand"),
      baselineSubjectDigests: [d("base")],
    });
    expect(report.status).toBe("draft");
    expect(isReportPublished(report)).toBe(false);
    expect(report.summary.decisionStatus).toBe("inconclusive");
    expect(report.limitations).toContain("not a public superiority claim");
    expect(report.signatureRefs).toEqual([]);

    const withRows = composeEvaluationReport({
      claim: claim(),
      protocol: protocol(),
      analysis: analysis.value,
      candidateSubjectDigest: d("cand"),
      baselineSubjectDigests: [d("base")],
      extraLimitations: ["local-only"],
      metricRows: [],
    });
    expect(withRows.limitations).toContain("local-only");
    expect(withRows.metricRows).toEqual([]);
  });
});
