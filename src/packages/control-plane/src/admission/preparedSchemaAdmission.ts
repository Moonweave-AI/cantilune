import type { PreparedAdmissionId } from "@cantilune/core";

/** Opaque prepared admission — construct only via control-plane prepare path. */
export interface PreparedSchemaAdmission {
  readonly preparedId: PreparedAdmissionId;
  readonly planDigest: string;
  readonly expiresAt: string;
}

const preparedBrand = Symbol("PreparedSchemaAdmission");

export function isPreparedSchemaAdmission(value: unknown): value is PreparedSchemaAdmission & {
  readonly [preparedBrand]: true;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    preparedBrand in value &&
    typeof (value as unknown as PreparedSchemaAdmission).preparedId === "string"
  );
}

/** @internal */
export function createPreparedSchemaAdmission(
  input: PreparedSchemaAdmission,
): PreparedSchemaAdmission & { readonly [preparedBrand]: true } {
  return { ...input, [preparedBrand]: true as const };
}
