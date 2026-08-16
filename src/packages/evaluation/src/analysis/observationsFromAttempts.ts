/**
 * Map run attempts to MetricObservation rows for E7 analysis.
 * Succeeded → 1, other terminal statuses → 0. Exploratory unless a scorer
 * already produced observations — this helper does not invent superiority.
 */
import { createHash } from "node:crypto";
import { contentDigest } from "@cantilune/core";
import type { RunAttempt } from "../execution/evaluationRun.js";
import {
  benchmarkCaseId,
  evaluationRunId,
  evaluationSubjectId,
  metricId,
  metricObservationId,
  runAttemptId,
  scorerRef,
} from "../foundation/evaluationIds.js";
import type { MetricObservation } from "../scoring/metricObservation.js";

export function observationsFromAttempts(
  attempts: readonly RunAttempt[],
  metricCode = "attempt-success",
): readonly MetricObservation[] {
  return attempts.map((attempt, index) => {
    const success = attempt.status === "succeeded" ? 1 : 0;
    const evidenceRefs =
      attempt.traceEvidenceRef !== undefined && attempt.traceEvidenceRef.length > 0
        ? [attempt.traceEvidenceRef]
        : attempt.outputRefs.length > 0
          ? [...attempt.outputRefs]
          : [`attempt:${attempt.attemptId as string}`];
    const row = {
      attempt: attempt.attemptId,
      status: attempt.status,
      success,
    };
    return {
      observationId: metricObservationId(`${attempt.attemptId as string}-${metricCode}-${index}`),
      metricRef: metricId(metricCode),
      runId: evaluationRunId(attempt.runId as string),
      attemptId: runAttemptId(attempt.attemptId as string),
      caseRef: benchmarkCaseId(attempt.caseRef as string),
      subjectRef: evaluationSubjectId(attempt.subjectRef as string),
      rawValue: success,
      normalizedValue: success,
      unit: "success",
      numerator: success,
      denominator: 1,
      scorerRef: scorerRef("evaluation/observationsFromAttempts"),
      judgeRef: undefined,
      evidenceRefs,
      status: "valid" as const,
      computedAt: attempt.endedAt ?? attempt.startedAt ?? new Date().toISOString(),
      rowDigest: contentDigest(createHash("sha256").update(JSON.stringify(row)).digest("hex")),
    };
  });
}
