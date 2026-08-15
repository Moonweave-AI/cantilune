import { describe, expect, it } from "vitest";
import { commsViolation, isCommsViolation } from "../../src/foundation/commsViolation.js";
import { deriveOperationFamily } from "../../src/protocol/communicationOperationRegistry.js";

describe("mutation gate targets", () => {
  it("preserves violation retryable default false", () => {
    const violation = commsViolation("codec_invalid", "ingress", "test");
    expect(violation.retryable).toBe(false);
    expect(isCommsViolation(violation)).toBe(true);
  });

  it("preserves reconnect family mapping", () => {
    expect(deriveOperationFamily("reconnect")).toBe("instanceReconnect");
    expect(deriveOperationFamily("reconnectHandoff")).toBe("delegation");
  });
});
