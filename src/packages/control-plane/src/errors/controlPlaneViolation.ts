export type ControlPlaneViolationCode =
  | "schema_not_found"
  | "schema_invalid"
  | "revision_conflict"
  | "digest_mismatch"
  | "codec_invalid"
  | "non_monotone_extension"
  | "declaration_deleted"
  | "declaration_redefined"
  | "port_contract_changed"
  | "structural_mode_changed"
  | "template_missing"
  | "handler_manifest_mismatch"
  | "epoch_not_advanced"
  | "stale_active_binding"
  | "runtime_head_changed"
  | "active_admissions_present"
  | "resources_not_clear"
  | "sessions_not_quiescent"
  | "conformance_missing"
  | "conformance_invalid"
  | "qualification_failed"
  | "authorization_denied"
  | "separation_of_duties_violation"
  | "preparation_expired"
  | "commit_conflict"
  | "idempotency_conflict"
  | "control_plane_frozen"
  | "invalid_input";

export type ControlPlanePhase =
  "register" | "validate" | "qualify" | "authorize" | "prepare" | "commit" | "activate" | "query";

export interface ControlPlaneViolation {
  readonly code: ControlPlaneViolationCode;
  readonly phase: ControlPlanePhase;
  readonly message: string;
  readonly path?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly retryable: boolean;
}

export function controlPlaneViolation(
  code: ControlPlaneViolationCode,
  phase: ControlPlanePhase,
  message: string,
  options?: {
    readonly path?: string;
    readonly expected?: string;
    readonly actual?: string;
    readonly retryable?: boolean;
  },
): ControlPlaneViolation {
  return {
    code,
    phase,
    message,
    ...(options?.path !== undefined ? { path: options.path } : {}),
    ...(options?.expected !== undefined ? { expected: options.expected } : {}),
    ...(options?.actual !== undefined ? { actual: options.actual } : {}),
    retryable: options?.retryable ?? false,
  };
}

export function isControlPlaneViolation(value: unknown): value is ControlPlaneViolation {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "phase" in value &&
    "message" in value
  );
}
