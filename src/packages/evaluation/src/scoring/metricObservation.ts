import type { ContentDigest } from "@cantilune/core";
import type {
  MetricObservationId,
  MetricId,
  EvaluationRunId,
  RunAttemptId,
  BenchmarkCaseId,
  EvaluationSubjectId,
  ScorerRef,
  JudgeProtocolId,
} from "../foundation/evaluationIds.js";
import type { MetricObservationStatus } from "../foundation/evaluationStatus.js";

export interface MetricObservation {
  readonly observationId: MetricObservationId;
  readonly metricRef: MetricId;
  readonly runId: EvaluationRunId;
  readonly attemptId: RunAttemptId;
  readonly caseRef: BenchmarkCaseId;
  readonly subjectRef: EvaluationSubjectId;
  readonly rawValue: number | undefined;
  readonly normalizedValue: number | undefined;
  readonly unit: string;
  readonly numerator: number | undefined;
  readonly denominator: number | undefined;
  readonly scorerRef: ScorerRef;
  readonly judgeRef: JudgeProtocolId | undefined;
  readonly evidenceRefs: readonly string[];
  readonly status: MetricObservationStatus;
  readonly computedAt: string;
  readonly rowDigest: ContentDigest;
}

export function isObservationValid(obs: MetricObservation): boolean {
  return obs.status === "valid";
}

/**
 * Only valid observations may enter publishable analysis.
 * Quarantined observations are retained for audit but excluded from conclusions.
 */
export function isObservationUsable(obs: MetricObservation): boolean {
  return obs.status === "valid";
}

export function isObservationQuarantined(obs: MetricObservation): boolean {
  return obs.status === "quarantined";
}

export function validateObservation(obs: MetricObservation): readonly string[] {
  const errors: string[] = [];
  if (obs.rawValue !== undefined && !Number.isFinite(obs.rawValue)) {
    errors.push("rawValue must be finite");
  }
  if (obs.normalizedValue !== undefined && !Number.isFinite(obs.normalizedValue)) {
    errors.push("normalizedValue must be finite");
  }
  if (obs.denominator !== undefined && obs.denominator === 0) {
    errors.push("denominator must not be zero");
  }
  if (obs.evidenceRefs.length === 0 && obs.status === "valid") {
    errors.push("valid observation requires at least one evidence ref");
  }
  return errors;
}
