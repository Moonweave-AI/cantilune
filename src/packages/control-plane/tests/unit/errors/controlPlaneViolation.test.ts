import { describe, expect, it } from "vitest";
import {
  controlPlaneViolation,
  isControlPlaneViolation,
} from "../../../src/errors/controlPlaneViolation.js";

describe("control plane violation helpers", () => {
  it("builds violation with optional fields", () => {
    const violation = controlPlaneViolation("invalid_input", "validate", "bad field", {
      path: "submit.admissionId",
      expected: "string",
      actual: "number",
      retryable: true,
    });
    expect(violation.code).toBe("invalid_input");
    expect(violation.phase).toBe("validate");
    expect(violation.path).toBe("submit.admissionId");
    expect(violation.expected).toBe("string");
    expect(violation.actual).toBe("number");
    expect(violation.retryable).toBe(true);
  });

  it("defaults retryable to false", () => {
    const violation = controlPlaneViolation("schema_not_found", "register", "missing");
    expect(violation.retryable).toBe(false);
    expect(violation.path).toBeUndefined();
  });

  it("detects violation shape", () => {
    expect(isControlPlaneViolation(controlPlaneViolation("invalid_input", "query", "x"))).toBe(
      true,
    );
    expect(isControlPlaneViolation(new Error("nope"))).toBe(false);
    expect(isControlPlaneViolation(null)).toBe(false);
  });
});
