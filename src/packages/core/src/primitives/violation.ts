/** Stable machine-readable codes for core semantic violations. */
export type CoreViolationCode =
  | "before_ref_chain_broken"
  | "epoch_mismatch"
  | "audit_tail_history_mismatch"
  | "observation_sequence_invalid"
  | "footprint_undercovers_targets"
  | "snapshot_integrity"
  | "actor_not_found"
  | "actor_kind_mismatch"
  | "run_history_invalid"
  | "match_bindings_invalid";

export interface CoreViolation {
  readonly code: CoreViolationCode;
  readonly message: string;
  readonly path?: string;
  readonly expected?: string;
  readonly actual?: string;
}

export class CoreError extends Error {
  readonly violation: CoreViolation;

  constructor(violation: CoreViolation) {
    super(violation.message);
    this.name = "CoreError";
    this.violation = violation;
  }
}

export function coreViolation(
  code: CoreViolationCode,
  message: string,
  details?: Pick<CoreViolation, "path" | "expected" | "actual">,
): CoreViolation {
  return { code, message, ...details };
}

export function throwCore(violation: CoreViolation): never {
  throw new CoreError(violation);
}
