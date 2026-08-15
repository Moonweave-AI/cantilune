import {
  isReadOnlyViolation,
  type ReadOnlyViolation,
  type ReadOnlyViolationCode,
} from "../../../src/foundation/readOnlyViolation.js";

export function expectReadOnlyViolation(
  run: () => unknown,
  code?: ReadOnlyViolationCode,
): ReadOnlyViolation {
  try {
    run();
    throw new Error("expected ReadOnlyViolation");
  } catch (error) {
    if (error instanceof Error && error.message === "expected ReadOnlyViolation") {
      throw error;
    }
    if (!isReadOnlyViolation(error)) {
      throw error;
    }
    const violation = error;
    if (code !== undefined && violation.code !== code) {
      throw new Error(`expected code ${code}, got ${violation.code}`);
    }
    return violation;
  }
}
