import type { DatasetStatus } from "../foundation/evaluationStatus.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";

const DATASET_TRANSITIONS: ReadonlyMap<DatasetStatus, readonly DatasetStatus[]> = new Map([
  ["proposed", ["provenanceChecked"]],
  ["provenanceChecked", ["privacyReviewed"]],
  ["privacyReviewed", ["approved"]],
  ["approved", ["frozen"]],
  ["frozen", ["active"]],
  ["active", ["expired", "quarantined", "deleted"]],
  ["expired", []],
  ["quarantined", ["active", "deleted"]],
  ["deleted", []],
]);

export function transitionDataset(
  current: DatasetStatus,
  target: DatasetStatus,
): EvaluationResult<DatasetStatus> {
  const allowed = DATASET_TRANSITIONS.get(current);
  if (!allowed?.includes(target)) {
    // NOSONAR — already uses optional chaining
    return violations([
      violation(
        "invalid_state_transition",
        "dataset.status",
        `Cannot transition dataset from '${current}' to '${target}'`,
        { current, target, allowed: allowed ?? [] },
      ),
    ]);
  }
  return ok(target);
}

export function isDatasetTerminal(status: DatasetStatus): boolean {
  return status === "expired" || status === "deleted";
}
