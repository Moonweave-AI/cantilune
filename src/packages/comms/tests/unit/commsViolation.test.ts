import { describe, expect, it } from "vitest";
import { commsViolation, isCommsViolation } from "../../src/foundation/commsViolation.js";

describe("commsViolation", () => {
  it("creates violation with defaults", () => {
    const v = commsViolation("codec_invalid", "ingress", "bad frame");
    expect(v.code).toBe("codec_invalid");
    expect(v.phase).toBe("ingress");
    expect(v.retryable).toBe(false);
  });

  it("accepts optional metadata", () => {
    const v = commsViolation("backpressure", "send", "full", {
      retryable: true,
      path: "outbox",
      expected: "1",
      actual: "2",
      correlationId: "corr-1",
      occurrenceId: "occ-1",
    });
    expect(v.retryable).toBe(true);
    expect(v.path).toBe("outbox");
    expect(v.expected).toBe("1");
    expect(v.actual).toBe("2");
    expect(v.correlationId).toBe("corr-1");
    expect(v.occurrenceId).toBe("occ-1");
  });

  it("isCommsViolation narrows unknown values", () => {
    const v = commsViolation("invalid_input", "query", "nope");
    expect(isCommsViolation(v)).toBe(true);
    expect(isCommsViolation("string")).toBe(false);
    expect(isCommsViolation(null)).toBe(false);
  });
});
