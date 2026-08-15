import { describe, it, expect } from "vitest";
import type { AggregateAnalysis } from "../../src/analysis/aggregateAnalysis.js";
import type { CertifiedTraceEvidence } from "../../src/collection/certifiedTraceEvidence.js";
import type { MetricDefinition } from "../../src/scoring/metricDefinition.js";
import type { EvaluationRun } from "../../src/execution/evaluationRun.js";
import type { RunStatus, ClaimLifecycle } from "../../src/foundation/evaluationStatus.js";
import {
  aggregateAnalysisId,
  evaluationRunPlanId,
  evaluationRunId,
  metricId,
  evaluationClaimId,
} from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

describe("Analysis and collection type fixtures", () => {
  it("accepts aggregate analysis shape", () => {
    const analysis: AggregateAnalysis = {
      analysisId: aggregateAnalysisId("analysis-1"),
      planRef: evaluationRunPlanId("plan-1"),
      runSetDigest: d("run-set-d"),
      population: "all-cases",
      includedRuns: [evaluationRunId("run-1")],
      excludedRuns: [
        { runId: evaluationRunId("run-2"), reason: "budget", exclusionCategory: "operational" },
      ],
      estimate: { pointEstimate: 0.1, standardError: 0.02, method: "bootstrap" },
      effectSize: { value: 0.3, method: "cohen-d", interpretation: "small" },
      confidenceOrCredibleInterval: { lower: 0.05, upper: 0.15, level: 0.95, method: "percentile" },
      pairedResults: [],
      stratifiedResults: [],
      missingnessAnalysis: {
        totalExpected: 10,
        totalMissing: 1,
        missingRate: 0.1,
        mechanism: "MCAR",
        imputationMethod: undefined,
        sensitivityToMissing: "robust",
      },
      sensitivityAnalysis: { alternativeSpecs: [], conclusionRobust: true },
      multipleComparisonAdjustment: "holm",
      stoppingAudit: {
        plannedLooks: 1,
        actualLooks: 1,
        earlyStopReasons: [],
        adjustmentApplied: false,
      },
      negativeResults: [],
      robustnessChecks: [{ name: "leave-one-out", passed: true, detail: "stable" }],
      analysisCodeBuild: "build-1",
      environmentRef: "env-1",
      analysisDigest: d("analysis-d"),
    };
    expect(analysis.includedRuns).toHaveLength(1);
  });

  it("accepts certified trace evidence shape", () => {
    const step = {
      status: "consistent" as const,
      evidenceRef: "evidence-1",
      detail: undefined,
    };
    const evidence: CertifiedTraceEvidence = {
      coreEventRef: "event-1",
      coreChangeDigest: d("change-d"),
      rule: "apply",
      matchRef: "match-1",
      derivationRef: "deriv-1",
      replayRecipeRef: "recipe-1",
      beforeRef: "snap-before" as CertifiedTraceEvidence["beforeRef"],
      eventRef: "event-1",
      afterRef: "snap-after" as CertifiedTraceEvidence["afterRef"],
      sourceConfigDigest: d("src-d"),
      targetConfigDigest: d("tgt-d"),
      signatureVersion: "v1",
      executionEpoch: "epoch-1" as CertifiedTraceEvidence["executionEpoch"],
      opportunityEpoch: 1,
      classification: "internal",
      rankBefore: 0,
      rankAfter: 1,
      resourceFacts: [],
      sessionFacts: [],
      deleteFacts: [],
      modelInputRef: undefined,
      policyInputRef: undefined,
      externalInputRef: undefined,
      branchChoiceIdentity: undefined,
      probability: undefined,
      sharedExecutionDigest: d("shared-d"),
      dagView: {
        viewName: "dag",
        mapState: step,
        mapEvent: step,
        lift: step,
        native: step,
        reflection: step,
        replay: step,
        terminal: step,
        mappedEventIdentities: [],
        evidenceChainDigest: d("chain-d"),
      },
      petriView: {
        viewName: "petri",
        mapState: step,
        mapEvent: step,
        lift: step,
        native: step,
        reflection: step,
        replay: step,
        terminal: step,
        mappedEventIdentities: [],
        evidenceChainDigest: d("chain-d"),
      },
      piCalcView: {
        viewName: "piCalc",
        mapState: step,
        mapEvent: step,
        lift: step,
        native: step,
        reflection: step,
        replay: step,
        terminal: step,
        mappedEventIdentities: [],
        evidenceChainDigest: d("chain-d"),
      },
      morphismView: {
        viewName: "morphism",
        mapState: step,
        mapEvent: step,
        lift: step,
        native: step,
        reflection: step,
        replay: step,
        terminal: step,
        mappedEventIdentities: [],
        evidenceChainDigest: d("chain-d"),
      },
      admissionEvidence: undefined,
    };
    expect(evidence.classification).toBe("internal");
  });

  it("accepts metric definition and run status unions", () => {
    const metric: MetricDefinition = {
      metricId: metricId("m1"),
      metricVersion: 1,
      claimRef: evaluationClaimId("c1"),
      endpointRole: "primary",
      inputSchemaRef: "schema-1",
      scorerRef: "scorer-1" as MetricDefinition["scorerRef"],
      scorerBuild: "build-1",
      scorerDigest: d("scorer-d"),
      unit: "ratio",
      direction: "higher",
      population: "all",
      stratification: [],
      aggregation: "mean",
      failureTreatment: "exclude",
      missingTreatment: "exclude",
      threshold: undefined,
      equivalenceMargin: undefined,
      uncertaintyMethod: "bootstrap",
      effectSizeMethod: "cohen-d",
      judgeProtocolRef: undefined,
      metricDigest: d("metric-d"),
    };

    const run: EvaluationRun = {
      runId: evaluationRunId("run-1"),
      planRef: evaluationRunPlanId("plan-1"),
      planDigest: d("plan-d"),
      subjectRef: "sub-1" as EvaluationRun["subjectRef"],
      status: "running" satisfies RunStatus,
      attemptIds: [],
      currentAttemptId: undefined,
      startedAt: "2026-01-01",
      endedAt: undefined,
      runDigest: d("run-d"),
    };

    const claimLifecycles: readonly ClaimLifecycle[] = [
      "proposed",
      "protocolFrozen",
      "measured",
      "decided",
      "independentlyReviewed",
      "published",
      "superseded",
      "retracted",
    ];
    const lifecycle = "decided" satisfies ClaimLifecycle;
    expect(metric.claimRef).toBe(evaluationClaimId("c1"));
    expect(metric.endpointRole).toBe("primary");
    expect(run.status).toBe("running");
    expect(claimLifecycles).toContain(lifecycle);
  });
});
