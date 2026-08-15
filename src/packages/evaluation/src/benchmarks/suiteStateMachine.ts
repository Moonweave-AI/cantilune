import type { SuiteStatus } from "../foundation/evaluationStatus.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";

const SUITE_TRANSITIONS: ReadonlyMap<SuiteStatus, readonly SuiteStatus[]> = new Map([
  ["draft", ["reviewPending"]],
  ["reviewPending", ["approved", "draft"]],
  ["approved", ["frozen"]],
  ["frozen", ["deprecated", "revoked"]],
  ["deprecated", []],
  ["revoked", []],
]);

export function transitionSuite(
  current: SuiteStatus,
  target: SuiteStatus,
): EvaluationResult<SuiteStatus> {
  const allowed = SUITE_TRANSITIONS.get(current);
  if (!allowed?.includes(target)) {
    // NOSONAR — already uses optional chaining
    return violations([
      violation(
        "invalid_state_transition",
        "suite.status",
        `Cannot transition suite from '${current}' to '${target}'`,
        { current, target, allowed: allowed ?? [] },
      ),
    ]);
  }
  return ok(target);
}

export function isSuiteTerminal(status: SuiteStatus): boolean {
  return status === "deprecated" || status === "revoked";
}
