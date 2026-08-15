export type ConformanceViolationCode =
  | "envelope_invalid"
  | "digest_mismatch"
  | "subject_mismatch"
  | "inventory_incomplete"
  | "inventory_duplicate"
  | "inventory_extra"
  | "provenance_invalid"
  | "proof_manifest_invalid"
  | "trust_invalid"
  | "revoked"
  | "expired"
  | "profile_insufficient"
  | "scope_escalation"
  | "replay_failed"
  | "projection_invalid"
  | "admission_invalid"
  | "probability_invalid"
  | "trajectory_invalid"
  | "missing_evidence"
  | "tool_unavailable"
  | "signature_invalid";

export interface ConformanceViolation {
  readonly code: ConformanceViolationCode;
  readonly message: string;
  readonly path?: string;
}

export function conformanceViolation(
  code: ConformanceViolationCode,
  message: string,
  path?: string,
): ConformanceViolation {
  return path === undefined ? { code, message } : { code, message, path };
}
