import { describe, expect, it } from "vitest";
import {
  A2A_PROFILE_PINNED,
  A2A_PROFILE_V1,
  A2A_PROTOCOL_VERSION_V1,
  COMMS_LIMITS,
  COMMS_REGISTRY_VERSION_V1,
  COMMS_WIRE_VERSION_V1,
} from "../../src/foundation/commsLimits.js";

describe("commsLimits", () => {
  it("pins wire and registry versions", () => {
    expect(COMMS_WIRE_VERSION_V1).toBe(1);
    expect(COMMS_REGISTRY_VERSION_V1).toBe(1);
    expect(A2A_PROFILE_PINNED).toBe("a2a/0.1");
    expect(A2A_PROFILE_V1).toBe("a2a/1.0");
    expect(A2A_PROTOCOL_VERSION_V1).toBe("1.0");
  });

  it("defines operational limits", () => {
    expect(COMMS_LIMITS.maxFrameBytes).toBeGreaterThan(0);
    expect(COMMS_LIMITS.maxRetryAttempts).toBeGreaterThan(0);
    expect(COMMS_LIMITS.maxInboxBacklog).toBeGreaterThan(0);
  });
});
