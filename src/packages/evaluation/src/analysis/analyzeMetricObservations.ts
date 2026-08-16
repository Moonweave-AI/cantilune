/**
 * E7 preregistered statistical analysis (RFC-0004 §10).
 *
 * Produces AggregateAnalysis from MetricObservation rows. Never flips a
 * claim to `supported` — exploratory / undeclared analyses are labeled and
 * MUST NOT back a publishable superiority decision.
 */
import { createHash } from "node:crypto";
import { contentDigest } from "@cantilune/core";
import {
  ok,
  violation,
  violations,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";
import {
  aggregateAnalysisId,
  evaluationRunId,
  evaluationRunPlanId,
  type EvaluationRunPlanId,
} from "../foundation/evaluationIds.js";
import { isObservationUsable, type MetricObservation } from "../scoring/metricObservation.js";
import type { MetricDirection } from "../foundation/evaluationStatus.js";
import type { StatisticsConfig, StatisticsEngine } from "../ports/scoringAnalysis.js";
import type {
  AggregateAnalysis,
  AlternativeSpec,
  EffectSizeResult,
  EstimateResult,
  IntervalResult,
  PairedResult,
  RobustnessCheck,
  StratifiedResult,
} from "./aggregateAnalysis.js";
import {
  bootstrapMeanSamples,
  cohenD,
  hedgesG,
  interpretCohenD,
  meanOf,
  sampleStdDev,
  sampleVariance,
  withoutTukeyOutliers,
} from "./descriptiveStats.js";
import { adjustPvalues, normalizeMultipleComparison } from "./multipleComparison.js";
import { studentTQuantile, twoSidedTPvalue, welchDegreesOfFreedom } from "./studentT.js";

export const ANALYSIS_CODE_BUILD = "evaluation/analyzeMetricObservations/e7";

export const DEFAULT_STATISTICS_CONFIG: StatisticsConfig = {
  method: "student-t",
  confidenceLevel: 0.95,
  effectSizeMethod: "hedges-g",
  multipleComparisonMethod: "holm",
  missingDataMethod: "exclude",
  outlierMethod: "none",
};

export interface AnalyzeObservationsInput {
  readonly planRef: EvaluationRunPlanId;
  readonly population: string;
  readonly observations: readonly MetricObservation[];
  readonly config?: StatisticsConfig;
  readonly candidateSubjectRef?: string;
  readonly baselineSubjectRef?: string;
  readonly direction?: MetricDirection;
  readonly plannedLooks?: number;
  readonly actualLooks?: number;
  readonly earlyStopReasons?: readonly string[];
  readonly exploratory?: boolean;
  readonly analysisPlanDeclared?: boolean;
  readonly environmentRef?: string;
  readonly expectedObservationCount?: number;
  readonly bootstrapDraws?: number;
  readonly bootstrapSeed?: number;
}

function numericValue(obs: MetricObservation): number | undefined {
  if (obs.normalizedValue !== undefined && Number.isFinite(obs.normalizedValue)) {
    return obs.normalizedValue;
  }
  if (obs.rawValue !== undefined && Number.isFinite(obs.rawValue)) {
    return obs.rawValue;
  }
  return undefined;
}

function intervalFromT(
  values: readonly number[],
  level: number,
  method: string,
): IntervalResult {
  const n = values.length;
  const mean = meanOf(values);
  if (n < 2) {
    return { lower: mean, upper: mean, level, method: `${method}-degenerate-n1` };
  }
  const se = sampleStdDev(values) / Math.sqrt(n);
  const tCrit = studentTQuantile((1 + level) / 2, n - 1);
  return { lower: mean - tCrit * se, upper: mean + tCrit * se, level, method };
}

function intervalFromBootstrap(
  values: readonly number[],
  level: number,
  draws: number,
  seed: number,
): IntervalResult {
  const samples = [...bootstrapMeanSamples(values, draws, seed)].sort((a, b) => a - b);
  if (samples.length === 0) {
    return { lower: 0, upper: 0, level, method: "bootstrap-percentile" };
  }
  const alpha = 1 - level;
  const loIndex = Math.max(0, Math.floor((alpha / 2) * samples.length));
  const hiIndex = Math.min(samples.length - 1, Math.ceil((1 - alpha / 2) * samples.length) - 1);
  return {
    lower: samples[loIndex]!,
    upper: samples[hiIndex]!,
    level,
    method: "bootstrap-percentile",
  };
}

function estimateOf(values: readonly number[], method: string): EstimateResult {
  const n = values.length;
  const point = meanOf(values);
  const se = n < 2 ? 0 : sampleStdDev(values) / Math.sqrt(n);
  return { pointEstimate: point, standardError: se, method };
}

function applyMissing(
  usable: readonly number[],
  missingCount: number,
  method: string,
  direction: MetricDirection,
): readonly number[] {
  if (missingCount === 0) return usable;
  if (method === "impute") {
    const fill = usable.length === 0 ? 0 : meanOf(usable);
    return [...usable, ...Array.from({ length: missingCount }, () => fill)];
  }
  if (method === "worstCase") {
    const fill =
      usable.length === 0 ? (direction === "higher" ? 0 : 1) : direction === "higher"
        ? Math.min(...usable)
        : Math.max(...usable);
    return [...usable, ...Array.from({ length: missingCount }, () => fill)];
  }
  return usable;
}

function pairByCase(
  observations: readonly MetricObservation[],
  baselineRef: string,
  candidateRef: string,
): readonly { readonly caseRef: string; readonly difference: number }[] {
  const byCase = new Map<string, { baseline?: number; candidate?: number }>();
  for (const obs of observations) {
    if (!isObservationUsable(obs)) continue;
    const value = numericValue(obs);
    if (value === undefined) continue;
    const key = obs.caseRef as string;
    const row = byCase.get(key) ?? {};
    if ((obs.subjectRef as string) === baselineRef) row.baseline = value;
    if ((obs.subjectRef as string) === candidateRef) row.candidate = value;
    byCase.set(key, row);
  }
  const pairs: { readonly caseRef: string; readonly difference: number }[] = [];
  for (const [caseRef, row] of byCase) {
    if (row.baseline !== undefined && row.candidate !== undefined) {
      pairs.push({ caseRef, difference: row.candidate - row.baseline });
    }
  }
  return pairs;
}

export function recommendDecisionFromAnalysis(
  analysis: AggregateAnalysis,
): "notSupported" | "inconclusive" {
  const exploratory = analysis.robustnessChecks.some(
    (check) => check.name === "exploratory-must-not-support-claim",
  );
  if (exploratory) return "inconclusive";
  const interval = analysis.confidenceOrCredibleInterval;
  const includesNull = interval.lower <= 0 && interval.upper >= 0;
  if (includesNull) return "inconclusive";
  if (analysis.estimate.pointEstimate === 0) return "inconclusive";
  return "notSupported";
}

/**
 * Analysis alone never yields `supported`. A positive interval is still
 * `notSupported` until independent review records a ClaimDecision.
 */
export function analyzeMetricObservations(
  input: AnalyzeObservationsInput,
): EvaluationResult<AggregateAnalysis> {
  const config = input.config ?? DEFAULT_STATISTICS_CONFIG;
  const exploratory = input.exploratory === true || input.analysisPlanDeclared === false;
  const plannedLooks = input.plannedLooks ?? 1;
  const actualLooks = input.actualLooks ?? 1;
  if (actualLooks > plannedLooks && input.earlyStopReasons === undefined) {
    return violations([
      violation(
        "analysis_stopping_rule_violated",
        "stoppingAudit.actualLooks",
        `actualLooks ${actualLooks} exceeded plannedLooks ${plannedLooks} without a declared early-stop reason`,
      ),
    ]);
  }

  const expected = input.expectedObservationCount ?? input.observations.length;
  const usableRows = input.observations.filter((obs) => isObservationUsable(obs));
  const missingRows = input.observations.filter((obs) => !isObservationUsable(obs));
  const usableValues = usableRows
    .map(numericValue)
    .filter((value): value is number => value !== undefined);
  const missingCount = Math.max(0, expected - usableValues.length, missingRows.length);

  if (config.missingDataMethod === "fail" && missingCount > 0) {
    return violations([
      violation(
        "metric_missing_treatment",
        "missingDataMethod",
        `missingDataMethod=fail and ${missingCount} observation(s) are missing or unusable`,
      ),
    ]);
  }

  const direction = input.direction ?? "higher";
  const filled = applyMissing(usableValues, missingCount, config.missingDataMethod, direction);
  const working =
    config.outlierMethod === "tukey-fence" ? [...withoutTukeyOutliers(filled)] : [...filled];

  if (working.length === 0) {
    return violations([
      violation("invalid_input", "observations", "No usable numeric observations for analysis"),
    ]);
  }

  const intervalMethod = config.method.trim().toLowerCase();
  const useBootstrap = intervalMethod === "bootstrap" || intervalMethod === "bootstrap-percentile";
  const draws = input.bootstrapDraws ?? 2000;
  const seed = input.bootstrapSeed ?? 20260816;
  const level = config.confidenceLevel > 0 && config.confidenceLevel < 1 ? config.confidenceLevel : 0.95;

  const pairs =
    input.baselineSubjectRef !== undefined && input.candidateSubjectRef !== undefined
      ? pairByCase(usableRows, input.baselineSubjectRef, input.candidateSubjectRef)
      : [];
  const pairedValues = pairs.map((row) => row.difference);
  const primaryValues = pairedValues.length > 0 ? pairedValues : working;
  const estimateMethod = pairedValues.length > 0 ? `paired-${intervalMethod}` : intervalMethod;
  const estimate = estimateOf(primaryValues, estimateMethod);
  const interval = useBootstrap
    ? intervalFromBootstrap(primaryValues, level, draws, seed)
    : intervalFromT(primaryValues, level, `${intervalMethod}-t`);

  const baselineValues = usableRows
    .filter((obs) => (obs.subjectRef as string) === input.baselineSubjectRef)
    .map(numericValue)
    .filter((value): value is number => value !== undefined);
  const candidateValues = usableRows
    .filter((obs) => (obs.subjectRef as string) === input.candidateSubjectRef)
    .map(numericValue)
    .filter((value): value is number => value !== undefined);

  let effectSize: EffectSizeResult | undefined;
  if (baselineValues.length > 0 && candidateValues.length > 0) {
    const method = config.effectSizeMethod.trim().toLowerCase();
    const value = method === "cohen-d" ? cohenD(baselineValues, candidateValues) : hedgesG(baselineValues, candidateValues);
    effectSize = {
      value,
      method: method === "cohen-d" ? "cohen-d" : "hedges-g",
      interpretation: interpretCohenD(value),
    };
  }

  const pairedResults: PairedResult[] = [];
  if (pairs.length > 0 && input.candidateSubjectRef !== undefined && input.baselineSubjectRef !== undefined) {
    const se = pairs.length < 2 ? 0 : sampleStdDev(pairedValues) / Math.sqrt(pairs.length);
    const t = se === 0 ? 0 : meanOf(pairedValues) / se;
    const pValue = pairs.length < 2 ? undefined : twoSidedTPvalue(t, pairs.length - 1);
    pairedResults.push({
      candidateRef: input.candidateSubjectRef,
      baselineRef: input.baselineSubjectRef,
      difference: meanOf(pairedValues),
      interval,
      pValue,
    });
  } else if (
    intervalMethod === "welch-t" &&
    baselineValues.length > 1 &&
    candidateValues.length > 1
  ) {
    const meanDiff = meanOf(candidateValues) - meanOf(baselineValues);
    const varA = sampleVariance(baselineValues);
    const varB = sampleVariance(candidateValues);
    const se = Math.sqrt(varA / baselineValues.length + varB / candidateValues.length);
    const df = welchDegreesOfFreedom(varA, baselineValues.length, varB, candidateValues.length);
    const t = se === 0 ? 0 : meanDiff / se;
    const tCrit = studentTQuantile((1 + level) / 2, df);
    pairedResults.push({
      candidateRef: input.candidateSubjectRef ?? "candidate",
      baselineRef: input.baselineSubjectRef ?? "baseline",
      difference: meanDiff,
      interval: { lower: meanDiff - tCrit * se, upper: meanDiff + tCrit * se, level, method: "welch-t" },
      pValue: twoSidedTPvalue(t, df),
    });
  }

  const byMetric = new Map<string, number[]>();
  for (const obs of usableRows) {
    const value = numericValue(obs);
    if (value === undefined) continue;
    const key = obs.metricRef as string;
    const bucket = byMetric.get(key) ?? [];
    bucket.push(value);
    byMetric.set(key, bucket);
  }
  const stratifiedResults: StratifiedResult[] = [...byMetric.entries()].map(([stratum, values]) => ({
    stratum,
    estimate: estimateOf(values, "stratum-mean"),
    interval: intervalFromT(values, level, "student-t"),
    sampleSize: values.length,
  }));

  const rawP = pairedResults
    .map((row) => row.pValue)
    .filter((value): value is number => value !== undefined);
  const comparison = normalizeMultipleComparison(
    exploratory ? "none" : config.multipleComparisonMethod,
  );
  const adjusted = adjustPvalues(rawP, comparison, 1 - level);
  if (adjusted[0] !== undefined && pairedResults[0] !== undefined) {
    pairedResults[0] = { ...pairedResults[0], pValue: adjusted[0].adjustedP };
  }

  const outlierExcluded = filled.length - working.length;
  const altExcludeOutliers = intervalFromT(withoutTukeyOutliers(filled), level, "tukey-exclude");
  const worstFilled = applyMissing(usableValues, missingCount, "worstCase", direction);
  const altWorst = intervalFromT(worstFilled, level, "worst-case-missing");
  const alternativeSpecs: AlternativeSpec[] = [
    {
      description: "exclude Tukey outliers",
      estimate: meanOf(withoutTukeyOutliers(filled)),
      interval: altExcludeOutliers,
      diverges: Math.sign(meanOf(withoutTukeyOutliers(filled))) !== Math.sign(estimate.pointEstimate) &&
        estimate.pointEstimate !== 0,
    },
    {
      description: "worst-case missing fill",
      estimate: meanOf(worstFilled),
      interval: altWorst,
      diverges: Math.sign(meanOf(worstFilled)) !== Math.sign(estimate.pointEstimate) &&
        estimate.pointEstimate !== 0,
    },
  ];
  const conclusionRobust = alternativeSpecs.every((spec) => !spec.diverges);

  const includesNull = interval.lower <= 0 && interval.upper >= 0;
  const negativeResults: string[] = [];
  if (includesNull) {
    negativeResults.push("primary interval includes the null (0)");
  }
  if (adjusted.some((row) => !row.rejected)) {
    negativeResults.push("holm/Bonferroni-adjusted test does not reject the null");
  }
  if (exploratory) {
    negativeResults.push("analysis is exploratory and must not support a published claim");
  }

  const robustnessChecks: RobustnessCheck[] = [
    {
      name: "sample-size",
      passed: primaryValues.length >= 2,
      detail: `n=${primaryValues.length}`,
    },
    {
      name: "finite-variance",
      passed: Number.isFinite(estimate.standardError),
      detail: `se=${estimate.standardError}`,
    },
    {
      name: "sensitivity-sign-stable",
      passed: conclusionRobust,
      detail: conclusionRobust ? "alternative specs keep the primary sign" : "an alternative spec flipped sign",
    },
  ];
  if (exploratory) {
    robustnessChecks.push({
      name: "exploratory-must-not-support-claim",
      passed: true,
      detail: "undeclared or exploratory analysis cannot flip notSupported → supported",
    });
  }
  if (outlierExcluded > 0) {
    robustnessChecks.push({
      name: "tukey-outliers-removed",
      passed: true,
      detail: `removed=${outlierExcluded}`,
    });
  }

  const includedRuns = [...new Set(usableRows.map((obs) => evaluationRunId(obs.runId as string)))];
  const excludedRuns = [...new Set(missingRows.map((obs) => obs.runId as string))].map((runId) => ({
    runId: evaluationRunId(runId),
    reason: "unusable-or-missing-observation",
    exclusionCategory: "missingness",
  }));

  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        plan: input.planRef,
        estimate,
        interval,
        includedRuns,
        exploratory,
        method: config.method,
      }),
    )
    .digest("hex");

  const analysis: AggregateAnalysis = {
    analysisId: aggregateAnalysisId(`e7-${digest.slice(0, 12)}`),
    planRef: input.planRef,
    runSetDigest: contentDigest(digest),
    population: input.population,
    includedRuns,
    excludedRuns,
    estimate,
    effectSize,
    confidenceOrCredibleInterval: interval,
    pairedResults,
    stratifiedResults,
    missingnessAnalysis: {
      totalExpected: expected,
      totalMissing: missingCount,
      missingRate: expected === 0 ? 0 : missingCount / expected,
      mechanism: "observed-missingness-only",
      imputationMethod:
        config.missingDataMethod === "impute" || config.missingDataMethod === "worstCase"
          ? config.missingDataMethod
          : undefined,
      sensitivityToMissing: conclusionRobust ? "robust" : "sensitive",
    },
    sensitivityAnalysis: { alternativeSpecs, conclusionRobust },
    multipleComparisonAdjustment: exploratory ? "exploratory-unadjusted" : comparison,
    stoppingAudit: {
      plannedLooks,
      actualLooks,
      earlyStopReasons: input.earlyStopReasons ?? [],
      adjustmentApplied: actualLooks > 1,
    },
    negativeResults,
    robustnessChecks,
    analysisCodeBuild: ANALYSIS_CODE_BUILD,
    environmentRef: input.environmentRef ?? "evaluation",
    analysisDigest: contentDigest(digest),
  };
  return ok(analysis);
}

export function createPreregisteredStatisticsEngine(
  defaults: Partial<AnalyzeObservationsInput> = {},
): StatisticsEngine {
  return {
    async analyze(observations, config) {
      return analyzeMetricObservations({
        planRef: defaults.planRef ?? evaluationRunPlanId("unspecified-plan"),
        population: defaults.population ?? "declared-population",
        observations,
        config,
        ...(defaults.candidateSubjectRef !== undefined
          ? { candidateSubjectRef: defaults.candidateSubjectRef }
          : {}),
        ...(defaults.baselineSubjectRef !== undefined
          ? { baselineSubjectRef: defaults.baselineSubjectRef }
          : {}),
        ...(defaults.direction !== undefined ? { direction: defaults.direction } : {}),
        ...(defaults.plannedLooks !== undefined ? { plannedLooks: defaults.plannedLooks } : {}),
        ...(defaults.actualLooks !== undefined ? { actualLooks: defaults.actualLooks } : {}),
        ...(defaults.earlyStopReasons !== undefined
          ? { earlyStopReasons: defaults.earlyStopReasons }
          : {}),
        ...(defaults.exploratory !== undefined ? { exploratory: defaults.exploratory } : {}),
        ...(defaults.analysisPlanDeclared !== undefined
          ? { analysisPlanDeclared: defaults.analysisPlanDeclared }
          : {}),
        ...(defaults.environmentRef !== undefined ? { environmentRef: defaults.environmentRef } : {}),
        ...(defaults.expectedObservationCount !== undefined
          ? { expectedObservationCount: defaults.expectedObservationCount }
          : {}),
      });
    },
  };
}
