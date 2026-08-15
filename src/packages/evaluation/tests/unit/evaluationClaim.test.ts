import { describe, it, expect } from "vitest";
import {
  isClaimFrozen,
  isProtocolFrozen,
  type EvaluationClaim,
  type EvaluationProtocol,
} from "../../src/claims/evaluationClaim.js";
import {
  evaluationClaimId,
  evaluationProtocolId,
  metricId,
} from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeClaim(overrides: Partial<EvaluationClaim> = {}): EvaluationClaim {
  return {
    claimId: evaluationClaimId("c1"),
    claimVersion: 1,
    claimCode: "evaluation.c1",
    statement: "claim",
    nullHypothesis: "H0",
    targetPopulation: "all",
    candidateSubjectPolicy: "latest",
    baselineFamily: "baseline",
    primaryMetricRefs: [metricId("m1")],
    secondaryMetricRefs: [],
    guardrailMetricRefs: [],
    successRule: ">",
    failureRule: "<",
    inconclusiveRule: "CI",
    samplePlanRef: "sp",
    uncertaintyMethod: "bootstrap",
    multipleComparisonPolicy: "holm",
    stoppingRule: "none",
    rescopeOrTerminationRule: "stop",
    ownerRef: "owner",
    requiredReviewerRoles: ["stats"],
    status: "protocolFrozen",
    protocolDigest: d("pd"),
    createdAt: "2026-01-01",
    frozenAt: "2026-01-02",
    supersedes: undefined,
    ...overrides,
  };
}

function makeProtocol(overrides: Partial<EvaluationProtocol> = {}): EvaluationProtocol {
  return {
    protocolId: evaluationProtocolId("p1"),
    protocolVersion: 1,
    claimRefs: [evaluationClaimId("c1")],
    benchmarkSuiteRef: "suite-1",
    candidateSelection: "latest",
    baselineSelection: "stable",
    populationDefinition: "all",
    samplingMethod: "census",
    sampleSize: 10,
    seedPolicy: "fixed",
    repetitionPolicy: "1x",
    randomizationPlan: "blocked",
    blindingPlan: "double",
    metricPlan: "primary",
    analysisPlan: "preregistered",
    missingDataPolicy: "exclude",
    outlierPolicy: "none",
    stoppingPolicy: "none",
    securityPlanRef: "sec",
    privacyPlanRef: "priv",
    budgetPolicyRef: "budget",
    reviewPolicyRef: "review",
    amendmentOf: undefined,
    protocolDigest: d("proto-d"),
    frozenAt: undefined,
    ...overrides,
  };
}

describe("Evaluation claim helpers", () => {
  it("detects frozen claim", () => {
    expect(isClaimFrozen(makeClaim())).toBe(true);
  });

  it("rejects proposed claim even with frozenAt", () => {
    expect(isClaimFrozen(makeClaim({ status: "proposed", frozenAt: "2026-01-02" }))).toBe(false);
  });

  it("rejects claim without frozenAt", () => {
    expect(isClaimFrozen(makeClaim({ frozenAt: undefined }))).toBe(false);
  });
});

describe("Evaluation protocol helpers", () => {
  it("detects frozen protocol", () => {
    expect(isProtocolFrozen(makeProtocol({ frozenAt: "2026-01-03" }))).toBe(true);
  });

  it("rejects unfrozen protocol", () => {
    expect(isProtocolFrozen(makeProtocol({ frozenAt: undefined }))).toBe(false);
  });
});
