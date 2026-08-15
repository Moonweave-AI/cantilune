import type { ContentDigest } from "@cantilune/core";
import type {
  AggregateAnalysisId,
  EvaluationRunPlanId,
  EvaluationRunId,
} from "../foundation/evaluationIds.js";

export interface AggregateAnalysis {
  readonly analysisId: AggregateAnalysisId;
  readonly planRef: EvaluationRunPlanId;
  readonly runSetDigest: ContentDigest;
  readonly population: string;
  readonly includedRuns: readonly EvaluationRunId[];
  readonly excludedRuns: readonly ExcludedRun[];
  readonly estimate: EstimateResult;
  readonly effectSize: EffectSizeResult | undefined;
  readonly confidenceOrCredibleInterval: IntervalResult;
  readonly pairedResults: readonly PairedResult[];
  readonly stratifiedResults: readonly StratifiedResult[];
  readonly missingnessAnalysis: MissingnessAnalysis;
  readonly sensitivityAnalysis: SensitivityAnalysis;
  readonly multipleComparisonAdjustment: string;
  readonly stoppingAudit: StoppingAudit;
  readonly negativeResults: readonly string[];
  readonly robustnessChecks: readonly RobustnessCheck[];
  readonly analysisCodeBuild: string;
  readonly environmentRef: string;
  readonly analysisDigest: ContentDigest;
}

export interface ExcludedRun {
  readonly runId: EvaluationRunId;
  readonly reason: string;
  readonly exclusionCategory: string;
}

export interface EstimateResult {
  readonly pointEstimate: number;
  readonly standardError: number;
  readonly method: string;
}

export interface EffectSizeResult {
  readonly value: number;
  readonly method: string;
  readonly interpretation: string;
}

export interface IntervalResult {
  readonly lower: number;
  readonly upper: number;
  readonly level: number;
  readonly method: string;
}

export interface PairedResult {
  readonly candidateRef: string;
  readonly baselineRef: string;
  readonly difference: number;
  readonly interval: IntervalResult;
  readonly pValue: number | undefined;
}

export interface StratifiedResult {
  readonly stratum: string;
  readonly estimate: EstimateResult;
  readonly interval: IntervalResult;
  readonly sampleSize: number;
}

export interface MissingnessAnalysis {
  readonly totalExpected: number;
  readonly totalMissing: number;
  readonly missingRate: number;
  readonly mechanism: string;
  readonly imputationMethod: string | undefined;
  readonly sensitivityToMissing: string;
}

export interface SensitivityAnalysis {
  readonly alternativeSpecs: readonly AlternativeSpec[];
  readonly conclusionRobust: boolean;
}

export interface AlternativeSpec {
  readonly description: string;
  readonly estimate: number;
  readonly interval: IntervalResult;
  readonly diverges: boolean;
}

export interface StoppingAudit {
  readonly plannedLooks: number;
  readonly actualLooks: number;
  readonly earlyStopReasons: readonly string[];
  readonly adjustmentApplied: boolean;
}

export interface RobustnessCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}
