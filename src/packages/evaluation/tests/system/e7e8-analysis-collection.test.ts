import { describe, expect, it } from "vitest";
import { analyzeMetricObservations } from "../../src/analysis/analyzeMetricObservations.js";
import { observationsFromAttempts } from "../../src/analysis/observationsFromAttempts.js";
import { bindEvidenceToObservations } from "../../src/collection/bindEvidenceToObservations.js";
import { collectCertifiedTraceEvidence } from "../../src/collection/collectCertifiedTraceEvidence.js";
import { collectTheoryOracleBundle } from "../../src/collection/collectTheoryOracleBundle.js";
import { composeEvaluationReport } from "../../src/reports/composeEvaluationReport.js";
import { evaluationRunPlanId } from "../../src/foundation/evaluationIds.js";
import type { EvaluationClaim, EvaluationProtocol } from "../../src/claims/evaluationClaim.js";
import type { RunAttempt } from "../../src/execution/evaluationRun.js";
import type { ContentDigest } from "@cantilune/core";
import { KNOWN_LEAN_SYMBOLS } from "../../src/oracles/theoryOracleEvidence.js";

const d = (s: string) => s as ContentDigest;

function attempt(id: string, status: RunAttempt["status"], subject: string, caseRef: string): RunAttempt {
  return {
    attemptId: id as RunAttempt["attemptId"],
    runId: `run-${subject}` as RunAttempt["runId"],
    idempotencyKey: id,
    planDigest: d("plan"),
    subjectRef: subject as RunAttempt["subjectRef"],
    caseRef: caseRef as RunAttempt["caseRef"],
    seed: 1,
    executionOrder: 1,
    status,
    workerId: "w" as RunAttempt["workerId"],
    leaseId: "l" as RunAttempt["leaseId"],
    fencingToken: "f" as RunAttempt["fencingToken"],
    startedAt: "2026-08-16T00:00:00Z",
    endedAt: "2026-08-16T00:00:01Z",
    inputRefs: [],
    outputRefs: [`out-${id}`],
    traceEvidenceRef: `trace-${id}`,
    observationEvidenceRef: undefined,
    admissionEvidenceRef: undefined,
    communicationEvidenceRef: undefined,
    providerReceiptRefs: [],
    rawArtifactRefs: [],
    sanitizedArtifactRefs: [],
    tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    toolUsage: { toolCalls: 0, toolErrors: 0 },
    networkUsage: { requestCount: 0, totalBytesIn: 0, totalBytesOut: 0 },
    wallTime: 1,
    cost: {
      modelCostCents: 0,
      toolCostCents: 0,
      networkCostCents: 0,
      totalCostCents: 0,
      currency: "USD",
      receiptRefs: [],
    },
    terminalDisposition: status,
    failureCategory: undefined,
    retryOf: undefined,
    environmentCaptureRef: undefined,
    resultDigest: d(id),
  };
}

describe("E7+E8 analysis and collection flow", () => {
  it("binds four-view + theory evidence then analyzes without claiming support", () => {
    const attempts = [
      attempt("a1", "succeeded", "base", "case-1"),
      attempt("a2", "failed", "base", "case-2"),
      attempt("b1", "succeeded", "cand", "case-1"),
      attempt("b2", "succeeded", "cand", "case-2"),
    ];
    const observations = observationsFromAttempts(attempts);
    const trace = collectCertifiedTraceEvidence({
      coreEventRef: "chg-flow",
      coreChangeDigest: "flow",
      beforeRef: "s0",
      afterRef: "s1",
      executionEpoch: "1",
      views: { dag: {}, petri: {}, piCalc: {}, morphism: {} },
    });
    expect(trace.ok).toBe(true);
    if (!trace.ok) return;
    const oracles = collectTheoryOracleBundle({
      repoRoot: process.cwd(),
      evaluatorRef: "e8-system",
      leanSymbols: [KNOWN_LEAN_SYMBOLS.eventReplayUnique],
    });
    const bound = bindEvidenceToObservations({
      observations,
      traces: [trace.value],
      oracles: oracles.evidence,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    const analysis = analyzeMetricObservations({
      planRef: evaluationRunPlanId("e7e8-plan"),
      population: "system-flow",
      observations: bound.value,
      candidateSubjectRef: "cand",
      baselineSubjectRef: "base",
      analysisPlanDeclared: true,
    });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    const report = composeEvaluationReport({
      claim: {
        claimId: "c-flow" as EvaluationClaim["claimId"],
        claimVersion: 1,
        claimCode: "evaluation.c5",
        statement: "observability-as-structure",
        nullHypothesis: "no paired difference",
        targetPopulation: "system-flow",
        candidateSubjectPolicy: "c9",
        baselineFamily: "ad-hoc",
        primaryMetricRefs: [],
        secondaryMetricRefs: [],
        guardrailMetricRefs: [],
        successRule: "CI",
        failureRule: "CI",
        inconclusiveRule: "review",
        samplePlanRef: "sp",
        uncertaintyMethod: "student-t",
        multipleComparisonPolicy: "holm",
        stoppingRule: "one-look",
        rescopeOrTerminationRule: "rescope",
        ownerRef: "owner",
        requiredReviewerRoles: ["stats"],
        status: "protocolFrozen",
        protocolDigest: d("pd"),
        createdAt: "2026-08-16",
        frozenAt: "2026-08-16",
        supersedes: undefined,
      },
      protocol: {
        protocolId: "p-flow" as EvaluationProtocol["protocolId"],
        protocolVersion: 1,
        claimRefs: [],
        benchmarkSuiteRef: "suite-flow",
        candidateSelection: "c9",
        baselineSelection: "pin",
        populationDefinition: "system-flow",
        samplingMethod: "census",
        sampleSize: 4,
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
        frozenAt: "2026-08-16",
      },
      analysis: analysis.value,
      candidateSubjectDigest: d("cand"),
      baselineSubjectDigests: [d("base")],
    });
    expect(report.status).toBe("draft");
    expect(report.summary.decisionStatus).not.toBe("supported");
    expect(oracles.blocksClaimSupport || report.limitations.length > 0).toBe(true);
  });
});
