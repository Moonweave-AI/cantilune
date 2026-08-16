/**
 * Pair two evaluation runs into an analysis record (RFC-0004 E6 analysis API).
 * Does not claim superiority — only reports attempt counts and status deltas.
 */
import { createHash } from "node:crypto";
import { contentDigest } from "@cantilune/core";
import {
  aggregateAnalysisId,
  evaluationRunId,
  evaluationRunPlanId,
} from "../foundation/evaluationIds.js";
import type { RunAttempt } from "../execution/evaluationRun.js";
import type { AggregateAnalysis, PairedResult } from "./aggregateAnalysis.js";

export interface RunCompareInput {
  readonly runA: string;
  readonly runB: string;
  readonly attemptsA: readonly RunAttempt[];
  readonly attemptsB: readonly RunAttempt[];
}

export function compareEvaluationRuns(input: RunCompareInput): AggregateAnalysis {
  const completedA = input.attemptsA.filter((a) => a.status === "succeeded").length;
  const completedB = input.attemptsB.filter((a) => a.status === "succeeded").length;
  const failedA = input.attemptsA.filter((a) => a.status === "failed").length;
  const failedB = input.attemptsB.filter((a) => a.status === "failed").length;
  const delta = completedB - completedA;
  const digest = createHash("sha256")
    .update(`${input.runA}|${input.runB}|${input.attemptsA.length}|${input.attemptsB.length}`)
    .digest("hex");

  const paired: PairedResult = {
    candidateRef: input.runB,
    baselineRef: input.runA,
    difference: delta,
    interval: { lower: delta, upper: delta, level: 0, method: "count-delta" },
    pValue: undefined,
  };

  return {
    analysisId: aggregateAnalysisId(`compare-${digest.slice(0, 12)}`),
    planRef: evaluationRunPlanId("cli-compare"),
    runSetDigest: contentDigest(digest),
    population: "cli-local-paired-runs",
    includedRuns: [evaluationRunId(input.runA), evaluationRunId(input.runB)],
    excludedRuns: [],
    estimate: {
      pointEstimate: delta,
      standardError: 0,
      method: "completed-attempt-count-delta",
    },
    effectSize: undefined,
    confidenceOrCredibleInterval: { lower: delta, upper: delta, level: 0, method: "none" },
    pairedResults: [paired],
    stratifiedResults: [],
    missingnessAnalysis: {
      totalExpected: input.attemptsA.length + input.attemptsB.length,
      totalMissing: 0,
      missingRate: 0,
      mechanism: "none",
      imputationMethod: undefined,
      sensitivityToMissing: "not-applicable",
    },
    sensitivityAnalysis: { alternativeSpecs: [], conclusionRobust: true },
    multipleComparisonAdjustment: "none",
    stoppingAudit: {
      plannedLooks: 1,
      actualLooks: 1,
      earlyStopReasons: [],
      adjustmentApplied: false,
    },
    negativeResults: [
      ...(failedA > 0 ? [`runA failed attempts=${failedA}`] : []),
      ...(failedB > 0 ? [`runB failed attempts=${failedB}`] : []),
    ],
    robustnessChecks: [],
    analysisCodeBuild: "evaluation/compareEvaluationRuns",
    environmentRef: "cli",
    analysisDigest: contentDigest(digest),
  };
}
