import { describe, it, expect } from "vitest";
import {
  isObservationValid,
  isObservationUsable,
  isObservationQuarantined,
  validateObservation,
  type MetricObservation,
} from "../../src/scoring/metricObservation.js";
import {
  metricObservationId,
  metricId,
  evaluationRunId,
  runAttemptId,
  benchmarkCaseId,
  evaluationSubjectId,
} from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeObservation(overrides: Partial<MetricObservation> = {}): MetricObservation {
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
    scorerRef: "scorer" as MetricObservation["scorerRef"],
    judgeRef: undefined,
    evidenceRefs: ["evidence-1"],
    status: "valid",
    computedAt: "2026-01-01",
    rowDigest: d("row-d"),
    ...overrides,
  };
}

describe("Metric observation helpers", () => {
  it("identifies valid and usable observations", () => {
    const obs = makeObservation();
    expect(isObservationValid(obs)).toBe(true);
    expect(isObservationUsable(obs)).toBe(true);
    expect(isObservationQuarantined(obs)).toBe(false);
  });

  it("identifies quarantined observations", () => {
    const obs = makeObservation({ status: "quarantined" });
    expect(isObservationQuarantined(obs)).toBe(true);
    expect(isObservationUsable(obs)).toBe(false);
  });

  it("validates finite values and evidence requirements", () => {
    expect(validateObservation(makeObservation())).toEqual([]);
    expect(validateObservation(makeObservation({ rawValue: Number.NaN }))).toContain(
      "rawValue must be finite",
    );
    expect(
      validateObservation(makeObservation({ normalizedValue: Number.POSITIVE_INFINITY })),
    ).toContain("normalizedValue must be finite");
    expect(validateObservation(makeObservation({ denominator: 0 }))).toContain(
      "denominator must not be zero",
    );
    expect(validateObservation(makeObservation({ evidenceRefs: [], status: "valid" }))).toContain(
      "valid observation requires at least one evidence ref",
    );
  });
});
