import type { ContentDigest } from "@cantilune/core";
import type { EvaluationResult } from "../foundation/evaluationResult.js";
import type { MetricDefinition } from "../scoring/metricDefinition.js";
import type { MetricObservation } from "../scoring/metricObservation.js";
import type { TheoryOracleEvidence } from "../oracles/theoryOracleEvidence.js";
import type { AggregateAnalysis } from "../analysis/aggregateAnalysis.js";
import type { HumanReviewRecord } from "../scoring/judgeProtocol.js";

export interface MetricScorer {
  score(
    metric: MetricDefinition,
    inputs: readonly unknown[],
    outputs: readonly unknown[],
  ): Promise<EvaluationResult<ScorerOutput>>;
}

export interface ScorerOutput {
  readonly rawValue: number;
  readonly normalizedValue: number;
  readonly unit: string;
  readonly numerator: number | undefined;
  readonly denominator: number | undefined;
  readonly scorerDigest: ContentDigest;
}

export interface TheoryOracle {
  evaluate(
    oracleScope: string,
    semanticLayer: string,
    traceEvidence: readonly unknown[],
    premiseEvidence: readonly unknown[],
  ): Promise<EvaluationResult<TheoryOracleEvidence>>;
}

export interface PropertyChecker {
  check(
    property: string,
    evidence: readonly unknown[],
  ): Promise<EvaluationResult<PropertyCheckResult>>;
}

export interface PropertyCheckResult {
  readonly property: string;
  readonly passed: boolean;
  readonly counterexample?: unknown;
  readonly checkerBuild: string;
  readonly checkerDigest: ContentDigest;
}

export interface StatisticsEngine {
  analyze(
    observations: readonly MetricObservation[],
    config: StatisticsConfig,
  ): Promise<EvaluationResult<AggregateAnalysis>>;
}

export interface StatisticsConfig {
  readonly method: string;
  readonly confidenceLevel: number;
  readonly effectSizeMethod: string;
  readonly multipleComparisonMethod: string;
  readonly missingDataMethod: string;
  readonly outlierMethod: string;
}

export interface JudgePort {
  judge(
    candidateOutput: unknown,
    baselineOutput: unknown,
    rubric: string,
    config: JudgeConfig,
  ): Promise<EvaluationResult<JudgeOutput>>;
}

export interface JudgeConfig {
  readonly judgeType: string;
  readonly masked: boolean;
  readonly randomizedOrder: boolean;
  readonly seed: number | undefined;
}

export interface JudgeOutput {
  readonly score: number;
  readonly rationale: string;
  readonly judgeDigest: ContentDigest;
}

export interface HumanReviewQueue {
  enqueue(reviewRequest: ReviewRequest): Promise<EvaluationResult<string>>;
  dequeue(reviewerId: string): Promise<ReviewRequest | undefined>;
  submit(record: HumanReviewRecord): Promise<EvaluationResult<void>>;
  getStatus(requestId: string): Promise<ReviewQueueStatus>;
}

export interface ReviewRequest {
  readonly requestId: string;
  readonly planRef: string;
  readonly evidenceRoot: ContentDigest;
  readonly requiredRoles: readonly string[];
  readonly requiredCount: number;
  readonly createdAt: string;
}

export type ReviewQueueStatus = "pending" | "inProgress" | "completed" | "expired";
