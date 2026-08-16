/**
 * E7 report composition (RFC-0004). Builds a draft EvaluationReport from a
 * preregistered AggregateAnalysis. Never publishes and never claims supported
 * without an explicit ClaimDecision + reviewer quorum.
 */
import { createHash } from "node:crypto";
import { contentDigest, type ContentDigest } from "@cantilune/core";
import type { EvaluationClaim, EvaluationProtocol } from "../claims/evaluationClaim.js";
import type { AggregateAnalysis } from "../analysis/aggregateAnalysis.js";
import { recommendDecisionFromAnalysis } from "../analysis/analyzeMetricObservations.js";
import {
  benchmarkSuiteId,
  reportId,
  type BenchmarkSuiteId,
} from "../foundation/evaluationIds.js";
import type { EvaluationReport, ReportMetricRow } from "./evaluationReport.js";

export interface ComposeEvaluationReportInput {
  readonly claim: EvaluationClaim;
  readonly protocol: EvaluationProtocol;
  readonly analysis: AggregateAnalysis;
  readonly candidateSubjectDigest: ContentDigest;
  readonly baselineSubjectDigests: readonly ContentDigest[];
  readonly suiteRef?: BenchmarkSuiteId;
  readonly metricRows?: readonly ReportMetricRow[];
  readonly extraLimitations?: readonly string[];
}

export function composeEvaluationReport(input: ComposeEvaluationReportInput): EvaluationReport {
  const decisionStatus = recommendDecisionFromAnalysis(input.analysis);
  const interval = input.analysis.confidenceOrCredibleInterval;
  const limitations = [
    "not independently reviewed",
    "not a public superiority claim",
    "kernel proved ≠ benchmark superior",
    "analysis alone cannot emit ClaimDecision.status=supported",
    ...(input.analysis.multipleComparisonAdjustment === "exploratory-unadjusted"
      ? ["exploratory analysis must not flip notSupported to supported"]
      : []),
    ...(input.extraLimitations ?? []),
  ];
  const metricRows =
    input.metricRows ??
    input.analysis.pairedResults.map((row) => ({
      metricId: "primary-paired-difference",
      metricName: "paired difference",
      role: "primary",
      candidateEstimate: row.difference,
      baselineEstimate: 0,
      difference: row.difference,
      interval: [row.interval.lower, row.interval.upper] as const,
      unit: "score",
      artifactSubjectDigest: input.candidateSubjectDigest,
      verifierBuild: input.analysis.analysisCodeBuild,
      policyVersion: "evaluation/e7",
      evidenceRootDigest: input.analysis.analysisDigest,
    }));
  const body = {
    claim: input.claim.claimId,
    protocol: input.protocol.protocolId,
    analysis: input.analysis.analysisId,
    estimate: input.analysis.estimate,
    interval,
    decisionStatus,
  };
  const digest = contentDigest(createHash("sha256").update(JSON.stringify(body)).digest("hex"));
  return {
    reportId: reportId(`e7-${digest.slice(0, 12)}`),
    reportVersion: 1,
    claimRef: input.claim.claimId,
    protocolRef: input.protocol.protocolId,
    suiteRef: input.suiteRef ?? benchmarkSuiteId(input.protocol.benchmarkSuiteRef),
    analysisRefs: [input.analysis.analysisId],
    candidateSubjectDigest: input.candidateSubjectDigest,
    baselineSubjectDigests: input.baselineSubjectDigests,
    evidenceRoot: input.analysis.analysisDigest,
    summary: {
      claimStatement: input.claim.statement,
      decisionStatus,
      primaryEffectEstimate: input.analysis.estimate.pointEstimate,
      primaryConfidenceInterval: [interval.lower, interval.upper],
      populationDescription: input.analysis.population,
      sampleSize: input.analysis.includedRuns.length,
      baselineDescription: input.claim.baselineFamily,
    },
    metricRows,
    limitations,
    negativeResults: input.analysis.negativeResults,
    status: "draft",
    publishedAt: undefined,
    supersedes: undefined,
    retractionReason: undefined,
    signatureRefs: [],
    reportDigest: digest,
  };
}
