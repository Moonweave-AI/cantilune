import type { CoreViolation, OperationTypeId } from "@cantilune/core";

/** Stable machine-readable runtime violation codes. */
export type RuntimeViolationCode =
  | "admission_rejected"
  | "template_not_found"
  | "policy_denied"
  | "resource_conflict"
  | "apply_failed"
  | "commit_atomic_failed"
  | "replay_mismatch"
  | "replay_chain_broken"
  | "observe_invalid"
  | "content_ref_unavailable"
  | "codec_invalid";

export interface RuntimeViolation {
  readonly code: RuntimeViolationCode;
  readonly message: string;
  readonly path?: string;
  readonly operationTypeId?: OperationTypeId;
  readonly cause?: CoreViolation;
  /**
   * The two values that were compared, for the violations that are a mismatch.
   * `CoreViolation` has always carried these; runtime violations did not, so a
   * mismatch surfaced as a bare code and the operator had to reproduce the
   * failure under a debugger to learn which side was wrong.
   */
  readonly expected?: string;
  readonly actual?: string;
}

export class RuntimeError extends Error {
  readonly violation: RuntimeViolation;

  constructor(violation: RuntimeViolation) {
    super(violation.message);
    this.name = "RuntimeError";
    this.violation = violation;
  }
}

export function runtimeViolation(
  code: RuntimeViolationCode,
  message: string,
  details?: Pick<RuntimeViolation, "path" | "operationTypeId" | "cause" | "expected" | "actual">,
): RuntimeViolation {
  return { code, message, ...details };
}

export function throwRuntime(violation: RuntimeViolation): never {
  throw new RuntimeError(violation);
}
