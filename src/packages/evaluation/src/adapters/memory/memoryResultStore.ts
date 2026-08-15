import type { EvaluationRunId } from "../../foundation/evaluationIds.js";
import { ok, type EvaluationResult } from "../../foundation/evaluationResult.js";
import type { MetricObservation } from "../../scoring/metricObservation.js";
import type { ResultStore } from "../../ports/stateGovernance.js";

export function createMemoryResultStore(): ResultStore {
  const observations: MetricObservation[] = [];

  return {
    async saveObservation(obs: MetricObservation): Promise<EvaluationResult<void>> {
      observations.push(obs);
      return ok(undefined);
    },

    async getObservations(runId: EvaluationRunId): Promise<readonly MetricObservation[]> {
      return observations.filter((o) => o.runId === runId);
    },

    async getObservationsByMetric(metricRef: string): Promise<readonly MetricObservation[]> {
      return observations.filter((o) => o.metricRef === metricRef);
    },
  };
}
