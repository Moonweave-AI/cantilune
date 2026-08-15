import type { RunStatus, AttemptStatus } from "../foundation/evaluationStatus.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";

const RUN_TRANSITIONS: ReadonlyMap<RunStatus, readonly RunStatus[]> = new Map([
  ["planned", ["admitted"]],
  ["admitted", ["queued"]],
  ["queued", ["leased", "cancelled"]],
  ["leased", ["running", "cancelled"]],
  [
    "running",
    [
      "collecting",
      "failed",
      "cancelled",
      "budgetExhausted",
      "providerUnavailable",
      "securityStopped",
    ],
  ],
  ["collecting", ["scoring", "failed", "dataQuarantined"]],
  ["scoring", ["analyzing", "failed"]],
  ["analyzing", ["reviewPending", "failed"]],
  ["reviewPending", ["accepted", "rejected"]],
  ["accepted", ["published"]],
  ["rejected", []],
  ["published", []],
  ["failed", []],
  ["cancelled", []],
  ["budgetExhausted", []],
  ["providerUnavailable", []],
  ["dataQuarantined", []],
  ["securityStopped", []],
]);

export function transitionRun(current: RunStatus, target: RunStatus): EvaluationResult<RunStatus> {
  const allowed = RUN_TRANSITIONS.get(current);
  if (!allowed?.includes(target)) {
    return violations([
      violation(
        "invalid_state_transition",
        "run.status",
        `Cannot transition run from '${current}' to '${target}'`,
        { current, target, allowed: allowed ?? [] },
      ),
    ]);
  }
  return ok(target);
}

const ATTEMPT_TRANSITIONS: ReadonlyMap<AttemptStatus, readonly AttemptStatus[]> = new Map([
  ["queued", ["running", "cancelled"]],
  ["running", ["succeeded", "failed", "timedOut", "cancelled"]],
  ["succeeded", []],
  ["failed", []],
  ["timedOut", []],
  ["cancelled", []],
]);

export function transitionAttempt(
  current: AttemptStatus,
  target: AttemptStatus,
): EvaluationResult<AttemptStatus> {
  const allowed = ATTEMPT_TRANSITIONS.get(current);
  if (!allowed?.includes(target)) {
    return violations([
      violation(
        "invalid_state_transition",
        "attempt.status",
        `Cannot transition attempt from '${current}' to '${target}'`,
        { current, target, allowed: allowed ?? [] },
      ),
    ]);
  }
  return ok(target);
}

export function isRunTerminal(status: RunStatus): boolean {
  return RUN_TRANSITIONS.get(status)?.length === 0;
}

export function isAttemptTerminal(status: AttemptStatus): boolean {
  return ATTEMPT_TRANSITIONS.get(status)?.length === 0;
}
