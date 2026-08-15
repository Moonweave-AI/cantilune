export type CommsViolationCode =
  | "codec_invalid"
  | "wire_unsupported"
  | "wire_expired"
  | "wire_oversized"
  | "digest_mismatch"
  | "signature_invalid"
  | "identity_unverified"
  | "authorization_denied"
  | "replay_detected"
  | "endpoint_policy_violation"
  | "protocol_incompatible"
  | "session_not_found"
  | "session_not_authorized"
  | "stale_channel_generation"
  | "stale_binding"
  | "admission_receipt_invalid"
  | "reconnect_plan_invalid"
  | "reconnect_conflict"
  | "recovery_required"
  | "quiescence_blocked"
  | "delivery_expired"
  | "delivery_rejected"
  | "backpressure"
  | "rate_limited"
  | "comms_frozen"
  | "transport_failed"
  | "runtime_commit_failed"
  | "invalid_input";

export type CommsPhase =
  | "ingress"
  | "authenticate"
  | "authorize"
  | "negotiate"
  | "session"
  | "send"
  | "receive"
  | "ack"
  | "delegate"
  | "reconnect"
  | "close"
  | "recover"
  | "query";

export interface CommsViolation {
  readonly code: CommsViolationCode;
  readonly phase: CommsPhase;
  readonly message: string;
  readonly path?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly correlationId?: string;
  readonly occurrenceId?: string;
  readonly retryable: boolean;
}

export function commsViolation(
  code: CommsViolationCode,
  phase: CommsPhase,
  message: string,
  options?: {
    readonly path?: string;
    readonly expected?: string;
    readonly actual?: string;
    readonly correlationId?: string;
    readonly occurrenceId?: string;
    readonly retryable?: boolean;
  },
): CommsViolation {
  return {
    code,
    phase,
    message,
    ...(options?.path !== undefined ? { path: options.path } : {}),
    ...(options?.expected !== undefined ? { expected: options.expected } : {}),
    ...(options?.actual !== undefined ? { actual: options.actual } : {}),
    ...(options?.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
    ...(options?.occurrenceId !== undefined ? { occurrenceId: options.occurrenceId } : {}),
    retryable: options?.retryable ?? false,
  };
}

export function isCommsViolation(value: unknown): value is CommsViolation {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "phase" in value &&
    "message" in value
  );
}
