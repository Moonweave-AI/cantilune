import type { CoordinationChange } from "./coordinationChange.js";
import { coreViolation, throwCore } from "../primitives/violation.js";

/** Validates committed changes form a continuous beforeRef → afterRef chain. */
export function validateBeforeRefChain(changes: readonly CoordinationChange[]): void {
  const result = validateBeforeRefChainResult(changes);
  if (!result.ok) {
    throwCore(result.error);
  }
}

export function validateBeforeRefChainResult(
  changes: readonly CoordinationChange[],
): { ok: true } | { ok: false; error: ReturnType<typeof coreViolation> } {
  for (let i = 1; i < changes.length; i++) {
    const prev = changes[i - 1];
    const curr = changes[i];
    if (prev === undefined || curr === undefined) {
      continue;
    }
    if (curr.beforeRef !== prev.afterRef) {
      return {
        ok: false,
        error: coreViolation(
          "before_ref_chain_broken",
          `beforeRef chain broken at ${curr.changeId}`,
          { expected: prev.afterRef, actual: curr.beforeRef, path: `changes[${i}].beforeRef` },
        ),
      };
    }
  }
  return { ok: true };
}

/** Validates all changes in a chain share the same epochId. */
export function validateEpochConsistent(changes: readonly CoordinationChange[]): void {
  const result = validateEpochConsistentResult(changes);
  if (!result.ok) {
    throwCore(result.error);
  }
}

export function validateEpochConsistentResult(
  changes: readonly CoordinationChange[],
): { ok: true } | { ok: false; error: ReturnType<typeof coreViolation> } {
  if (changes.length === 0) {
    return { ok: true };
  }
  const epoch = changes[0]?.epochId;
  for (const change of changes) {
    if (change.epochId !== epoch) {
      return {
        ok: false,
        error: coreViolation("epoch_mismatch", `epoch mismatch at ${change.changeId}`, {
          expected: epoch ?? "unknown",
          actual: change.epochId,
          path: "epochId",
        }),
      };
    }
  }
  return { ok: true };
}
