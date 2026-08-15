import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { EvaluationRunId, RunAttemptId } from "../../foundation/evaluationIds.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { EvaluationRun, RunAttempt } from "../../execution/evaluationRun.js";
import type { RunStore } from "../../ports/stateGovernance.js";

function validatePathSegment(segment: string): boolean {
  return /^[a-zA-Z0-9\-_.]+$/.test(segment) && !segment.includes("..");
}

async function atomicWrite(filePath: string, data: string): Promise<EvaluationResult<void>> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpFile = `${filePath}.tmp.${Date.now()}`;
  try {
    await fs.writeFile(tmpFile, data);
    await fs.rename(tmpFile, filePath);
    return ok(undefined);
  } catch (err) {
    await fs.unlink(tmpFile).catch(() => {});
    return violations([
      violation(
        "store_write_failed",
        filePath,
        `Atomic write failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    ]);
  }
}

async function safeRead<T>(filePath: string): Promise<EvaluationResult<T | undefined>> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    try {
      return ok(JSON.parse(data) as T);
    } catch {
      return violations([
        violation("store_corrupted", filePath, "JSON parse failed — file corrupted"),
      ]);
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return ok(undefined);
    return violations([
      violation("store_read_failed", filePath, `Read failed: ${(err as Error).message}`),
    ]);
  }
}

export function createFileRunStore(baseDir: string): RunStore {
  const runsDir = path.join(baseDir, "runs");
  const attemptsDir = path.join(baseDir, "attempts");

  return {
    async save(run: EvaluationRun): Promise<EvaluationResult<void>> {
      if (!validatePathSegment(run.runId)) {
        return violations([
          violation("invalid_input", "run.runId", `Invalid run ID format: ${run.runId}`),
        ]);
      }
      const filePath = path.join(runsDir, `${run.runId}.json`);
      return atomicWrite(filePath, JSON.stringify(run, null, 2));
    },

    async get(runId: EvaluationRunId): Promise<EvaluationRun | undefined> {
      if (!validatePathSegment(runId)) return undefined;
      const result = await safeRead<EvaluationRun>(path.join(runsDir, `${runId}.json`));
      return result.ok ? result.value : undefined;
    },

    async listByPlan(planRef: string): Promise<readonly EvaluationRun[]> {
      try {
        const files = await fs.readdir(runsDir);
        const runs: EvaluationRun[] = [];
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const result = await safeRead<EvaluationRun>(path.join(runsDir, file));
          if (result.ok && result.value?.planRef === planRef) {
            runs.push(result.value);
          }
        }
        return runs;
      } catch {
        return [];
      }
    },

    async saveAttempt(attempt: RunAttempt): Promise<EvaluationResult<void>> {
      if (!validatePathSegment(attempt.attemptId)) {
        return violations([
          violation(
            "invalid_input",
            "attempt.attemptId",
            `Invalid attempt ID format: ${attempt.attemptId}`,
          ),
        ]);
      }
      const filePath = path.join(attemptsDir, `${attempt.attemptId}.json`);
      return atomicWrite(filePath, JSON.stringify(attempt, null, 2));
    },

    async getAttempt(attemptId: RunAttemptId): Promise<RunAttempt | undefined> {
      if (!validatePathSegment(attemptId)) return undefined;
      const result = await safeRead<RunAttempt>(path.join(attemptsDir, `${attemptId}.json`));
      return result.ok ? result.value : undefined;
    },

    async listAttempts(runId: EvaluationRunId): Promise<readonly RunAttempt[]> {
      try {
        const files = await fs.readdir(attemptsDir);
        const attempts: RunAttempt[] = [];
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const result = await safeRead<RunAttempt>(path.join(attemptsDir, file));
          if (result.ok && result.value?.runId === runId) {
            attempts.push(result.value);
          }
        }
        return attempts;
      } catch {
        return [];
      }
    },
  };
}
