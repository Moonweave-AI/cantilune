import { describe, expect, it } from "vitest";
import { defaultNegotiatedProtocol } from "../../src/peer/negotiatedProtocol.js";
import { wireVersion } from "../../src/foundation/messageId.js";

describe("negotiatedProtocol", () => {
  it("builds default protocol from wire and transport", () => {
    const protocol = defaultNegotiatedProtocol(wireVersion(1), "loopback");
    expect(protocol.wireVersion).toBe(1);
    expect(protocol.transport).toBe("loopback");
    expect(protocol.codecRef).toBe("comms/wire-v1");
    expect(protocol.protocolVersion).toBe("comms/1");
    expect(protocol.a2aProfile).toBe("a2a/0.1");
  });
});
