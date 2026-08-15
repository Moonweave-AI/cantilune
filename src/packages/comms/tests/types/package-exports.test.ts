import { describe, expect, it } from "vitest";
import * as comms from "../../src/index.js";
import * as memory from "../../src/memory/index.js";
import * as file from "../../src/file/index.js";
import * as a2a from "../../src/transports/a2a/index.js";
import * as runtime from "../../src/integration/index.js";
import * as conformance from "../../src/conformance/index.js";

describe("comms package exports", () => {
  it("re-exports core comms services and wire codec", () => {
    expect(typeof comms.createCommsServices).toBe("function");
    expect(typeof comms.CommsIngress).toBe("function");
    expect(typeof comms.parseCommunicationWireFrame).toBe("function");
    expect(typeof comms.encodeCommunicationWireFrame).toBe("function");
    expect(typeof comms.HmacIdentityVerifier).toBe("function");
    expect(typeof comms.ReconnectCoordinator).toBe("function");
  });

  it("exposes memory subpath", () => {
    expect(typeof memory.MemoryCommsStore).toBe("function");
    expect(typeof memory.LoopbackTransport).toBe("function");
  });

  it("exposes file subpath", () => {
    expect(typeof file.createFileCommsStore).toBe("function");
    expect(typeof file.FileCommsStore).toBe("function");
  });

  it("exposes a2a transport subpath", () => {
    expect(typeof a2a.A2ATransportAdapter).toBe("function");
    expect(typeof a2a.encodeA2AFrame).toBe("function");
  });

  it("exposes runtime integration subpath", () => {
    expect(typeof runtime.createRuntimeCommsPorts).toBe("function");
  });

  it("exposes conformance subpath", () => {
    expect(typeof conformance.verifyCommsProductCertificate).toBe("function");
    expect(typeof conformance.commsCertificateComplete).toBe("function");
    expect(Array.isArray(conformance.COMMS_RULE_INVENTORY)).toBe(true);
  });
});
