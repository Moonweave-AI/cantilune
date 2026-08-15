import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import { err, ok, type Result } from "@cantilune/core";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): Result<void, ControlPlaneViolation> {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      return err(
        controlPlaneViolation("invalid_input", "validate", `unknown field ${key}`, {
          path: `${path}.${key}`,
        }),
      );
    }
  }
  return ok(undefined);
}

export function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<string, ControlPlaneViolation> {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    return err(
      controlPlaneViolation("invalid_input", "validate", `expected non-empty string at ${key}`, {
        path: `${path}.${key}`,
      }),
    );
  }
  return ok(value);
}

export function requireNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Result<number, ControlPlaneViolation> {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return err(
      controlPlaneViolation("invalid_input", "validate", `expected finite number at ${key}`, {
        path: `${path}.${key}`,
      }),
    );
  }
  return ok(value);
}

export function requireObject(
  value: unknown,
  path: string,
): Result<Record<string, unknown>, ControlPlaneViolation> {
  if (!isRecord(value)) {
    return err(controlPlaneViolation("invalid_input", "validate", "expected object", { path }));
  }
  return ok(value);
}
