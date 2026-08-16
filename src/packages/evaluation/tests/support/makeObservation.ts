import type { ContentDigest } from "@cantilune/core";
import type { MetricObservation } from "../../src/scoring/metricObservation.js";
import {
  benchmarkCaseId,
  evaluationRunId,
  evaluationSubjectId,
  metricId,
  metricObservationId,
  runAttemptId,
  scorerRef,
} from "../../src/foundation/evaluationIds.js";

export function makeObservation(overrides: Partial<MetricObservation> = {}): MetricObservation {
  return {
    observationId: metricObservationId("obs-1"),
    metricRef: metricId("m1"),
    runId: evaluationRunId("run-1"),
    attemptId: runAttemptId("a1"),
    caseRef: benchmarkCaseId("case-1"),
    subjectRef: evaluationSubjectId("sub-1"),
    rawValue: 0.9,
    normalizedValue: 0.9,
    unit: "ratio",
    numerator: 9,
    denominator: 10,
    scorerRef: scorerRef("scorer"),
    judgeRef: undefined,
    evidenceRefs: ["evidence-1"],
    status: "valid",
    computedAt: "2026-01-01",
    rowDigest: "row-d" as ContentDigest,
    ...overrides,
  };
}
