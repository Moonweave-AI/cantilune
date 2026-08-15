import type { EvaluationRunId, RunAttemptId } from "../../foundation/evaluationIds.js";
import { ok, type EvaluationResult } from "../../foundation/evaluationResult.js";
import type { EvaluationRun, RunAttempt } from "../../execution/evaluationRun.js";
import type { RunStore } from "../../ports/stateGovernance.js";

export function createMemoryRunStore(): RunStore {
  const runs = new Map<string, EvaluationRun>();
  const attempts = new Map<string, RunAttempt>();

  return {
    async save(run: EvaluationRun): Promise<EvaluationResult<void>> {
      runs.set(run.runId, run);
      return ok(undefined);
    },

    async get(runId: EvaluationRunId): Promise<EvaluationRun | undefined> {
      return runs.get(runId);
    },

    async listByPlan(planRef: string): Promise<readonly EvaluationRun[]> {
      return [...runs.values()].filter((r) => r.planRef === planRef);
    },

    async saveAttempt(attempt: RunAttempt): Promise<EvaluationResult<void>> {
      attempts.set(attempt.attemptId, attempt);
      return ok(undefined);
    },

    async getAttempt(attemptId: RunAttemptId): Promise<RunAttempt | undefined> {
      return attempts.get(attemptId);
    },

    async listAttempts(runId: EvaluationRunId): Promise<readonly RunAttempt[]> {
      return [...attempts.values()].filter((a) => a.runId === runId);
    },
  };
}
