import { describe, expect, it } from "vitest";
import * as comms from "../../src/index.js";
import * as memory from "../../src/memory/index.js";
import * as file from "../../src/file/index.js";
import * as a2a from "../../src/transports/a2a/index.js";
import * as runtime from "../../src/integration/index.js";
import * as conformance from "../../src/conformance/index.js";
import * as net from "../../src/transports/net/index.js";

describe("comms package exports", () => {
  it("re-exports core comms services and wire codec", () => {
    expect(typeof comms.createCommsServices).toBe("function");
    expect(typeof comms.CommsIngress).toBe("function");
    expect(typeof comms.parseCommunicationWireFrame).toBe("function");
    expect(typeof comms.encodeCommunicationWireFrame).toBe("function");
    expect(typeof comms.HmacIdentityVerifier).toBe("function");
    expect(typeof comms.composeProductionIdentityVerifier).toBe("function");
    expect(typeof comms.resolveCommsHmacKey).toBe("function");
    expect(typeof comms.rotateEndpointPin).toBe("function");
    expect(typeof comms.transferChannelCapability).toBe("function");
    expect(typeof comms.createHttpA2AFrameHandlers).toBe("function");
    expect(typeof comms.ReconnectCoordinator).toBe("function");
    expect(typeof comms.A2AOperationEngine).toBe("function");
    expect(typeof comms.handleA2AJsonRpc).toBe("function");
    expect(typeof comms.handleA2ARestRequest).toBe("function");
    expect(typeof comms.encodeA2ASseStream).toBe("function");
    expect(typeof comms.invokeA2AGrpc).toBe("function");
    expect(typeof comms.createA2AGrpcServer).toBe("function");
    expect(typeof comms.createA2AGrpcClient).toBe("function");
    expect(comms.A2A_GRPC_PROTO_SERVICE_NAME).toBe("lf.a2a.v1.A2AService");
    expect(comms.A2A_PROFILE_V1).toBe("a2a/1.0");
    expect(comms.A2A_PROTOCOL_VERSION_V1).toBe("1.0");
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
    expect(typeof a2a.A2AOperationEngine).toBe("function");
    expect(typeof a2a.handleA2AJsonRpc).toBe("function");
  });

  it("exposes runtime integration subpath", () => {
    expect(typeof runtime.createRuntimeCommsPorts).toBe("function");
  });

  it("exposes conformance subpath", () => {
    expect(typeof conformance.verifyCommsProductCertificate).toBe("function");
    expect(typeof conformance.commsCertificateComplete).toBe("function");
    expect(Array.isArray(conformance.COMMS_RULE_INVENTORY)).toBe(true);
    expect(typeof conformance.runA2AConformanceHarness).toBe("function");
  });

  it("exposes net transport subpath", () => {
    expect(typeof net.NetTransport).toBe("function");
    expect(typeof net.connectNetTransportPair).toBe("function");
    expect(typeof comms.issueSelfSignedMtlsPair).toBe("function");
    expect(typeof comms.createMtlsEndpointIdentityVerifier).toBe("function");
    expect(typeof comms.runA2AConformanceHarness).toBe("function");
  });
});
