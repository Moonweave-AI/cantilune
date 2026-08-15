import type { ContentDigest } from "@cantilune/core";
import type {
  ReportId,
  EvaluationClaimId,
  EvaluationProtocolId,
  AggregateAnalysisId,
  BenchmarkSuiteId,
} from "../foundation/evaluationIds.js";

export interface EvaluationReport {
  readonly reportId: ReportId;
  readonly reportVersion: number;
  readonly claimRef: EvaluationClaimId;
  readonly protocolRef: EvaluationProtocolId;
  readonly suiteRef: BenchmarkSuiteId;
  readonly analysisRefs: readonly AggregateAnalysisId[];
  readonly candidateSubjectDigest: ContentDigest;
  readonly baselineSubjectDigests: readonly ContentDigest[];
  readonly evidenceRoot: ContentDigest;
  readonly summary: ReportSummary;
  readonly metricRows: readonly ReportMetricRow[];
  readonly limitations: readonly string[];
  readonly negativeResults: readonly string[];
  readonly status: ReportStatus;
  readonly publishedAt: string | undefined;
  readonly supersedes: ReportId | undefined;
  readonly retractionReason: string | undefined;
  readonly signatureRefs: readonly string[];
  readonly reportDigest: ContentDigest;
}

export interface ReportSummary {
  readonly claimStatement: string;
  readonly decisionStatus: string;
  readonly primaryEffectEstimate: number;
  readonly primaryConfidenceInterval: readonly [number, number];
  readonly populationDescription: string;
  readonly sampleSize: number;
  readonly baselineDescription: string;
}

export interface ReportMetricRow {
  readonly metricId: string;
  readonly metricName: string;
  readonly role: string;
  readonly candidateEstimate: number;
  readonly baselineEstimate: number;
  readonly difference: number;
  readonly interval: readonly [number, number];
  readonly unit: string;
  readonly artifactSubjectDigest: ContentDigest;
  readonly verifierBuild: string;
  readonly policyVersion: string;
  readonly evidenceRootDigest: ContentDigest;
}

export type ReportStatus =
  "draft" | "reviewPending" | "approved" | "published" | "superseded" | "retracted";

export function isReportPublished(report: EvaluationReport): boolean {
  return report.status === "published" && report.publishedAt !== undefined;
}
