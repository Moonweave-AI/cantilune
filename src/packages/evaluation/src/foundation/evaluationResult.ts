/**
 * Structured result type — all evaluation operations return
 * Result<T, EvaluationViolation[]> instead of bare booleans.
 */
export type EvaluationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly violations: readonly EvaluationViolation[] };

export interface EvaluationViolation {
  readonly code: EvaluationViolationCode;
  readonly path: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export type EvaluationViolationCode =
  | "claim_not_frozen"
  | "protocol_not_frozen"
  | "suite_not_frozen"
  | "dataset_not_approved"
  | "subject_certificate_invalid"
  | "subject_certificate_revoked"
  | "subject_certificate_expired"
  | "subject_digest_mismatch"
  | "baseline_provenance_unavailable"
  | "plan_digest_mismatch"
  | "run_not_admitted"
  | "run_budget_exhausted"
  | "run_lease_expired"
  | "run_lease_held"
  | "run_fencing_token_stale"
  | "attempt_already_completed"
  | "attempt_retry_limit"
  | "evidence_digest_mismatch"
  | "evidence_incomplete"
  | "oracle_premise_missing"
  | "oracle_checker_unavailable"
  | "metric_scorer_mismatch"
  | "metric_missing_treatment"
  | "analysis_population_mismatch"
  | "analysis_stopping_rule_violated"
  | "review_quorum_not_met"
  | "review_coi_detected"
  | "review_self_review"
  | "claim_guardrail_violated"
  | "claim_already_published"
  | "claim_already_retracted"
  | "report_evidence_root_mismatch"
  | "report_signature_invalid"
  | "budget_reserve_failed"
  | "budget_reconciliation_failed"
  | "security_sandbox_breach"
  | "security_secret_exposure"
  | "privacy_pii_detected"
  | "privacy_residency_violated"
  | "invalid_state_transition"
  | "invalid_input"
  | "internal_error"
  | "ledger_chain_broken"
  | "store_write_failed"
  | "store_read_failed"
  | "store_corrupted"
  | "budget_exhausted";

export function ok<T>(value: T): EvaluationResult<T> {
  return { ok: true, value };
}

export function violations<T>(vs: readonly EvaluationViolation[]): EvaluationResult<T> {
  return { ok: false, violations: vs };
}

export function violation(
  code: EvaluationViolationCode,
  path: string,
  message: string,
  context?: Readonly<Record<string, unknown>>,
): EvaluationViolation {
  return context !== undefined ? { code, path, message, context } : { code, path, message };
}
