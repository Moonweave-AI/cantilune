/** Observability-side failure — never mutates core/runtime state. */
export type ReadOnlyViolationCode =
  "invalid_input" | "derive_failed" | "cross_view_mismatch" | "snapshot_unavailable";

export interface ReadOnlyViolation {
  readonly code: ReadOnlyViolationCode;
  readonly message: string;
  readonly path?: string;
}

export function readOnlyViolation(
  code: ReadOnlyViolationCode,
  message: string,
  path?: string,
): ReadOnlyViolation {
  return path === undefined ? { code, message } : { code, message, path };
}

export function isReadOnlyViolation(value: unknown): value is ReadOnlyViolation {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as ReadOnlyViolation).code === "string"
  );
}
