import { describe, expect, it } from "vitest";
import { mapA2AStatusToViolation } from "../../src/transports/a2a/a2aErrorMap.js";

describe("a2aErrorMap", () => {
  it("maps known A2A statuses to comms violation codes", () => {
    expect(mapA2AStatusToViolation("UNAUTHENTICATED")).toBe("identity_unverified");
    expect(mapA2AStatusToViolation("PERMISSION_DENIED")).toBe("authorization_denied");
    expect(mapA2AStatusToViolation("NOT_FOUND")).toBe("session_not_found");
    expect(mapA2AStatusToViolation("RESOURCE_EXHAUSTED")).toBe("backpressure");
    expect(mapA2AStatusToViolation("UNAVAILABLE")).toBe("transport_failed");
    expect(mapA2AStatusToViolation("DEADLINE_EXCEEDED")).toBe("delivery_expired");
  });

  it("defaults unknown statuses to transport_failed", () => {
    expect(mapA2AStatusToViolation("UNKNOWN")).toBe("transport_failed");
  });
});
