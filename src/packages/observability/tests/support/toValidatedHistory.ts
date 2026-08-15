import {
  emptyRunHistory,
  validateRunHistory,
  type UnvalidatedTrace,
  type ValidatedRunHistory,
} from "@cantilune/core";

export function toValidatedHistory(
  history: UnvalidatedTrace = emptyRunHistory(),
): ValidatedRunHistory {
  return validateRunHistory(history);
}
