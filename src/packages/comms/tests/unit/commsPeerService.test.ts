import { describe, expect, it } from "vitest";
import { CommsPeerService } from "../../src/engine/commsPeerService.js";
import { buildTestPeerDescriptor } from "../support/envelopeFixtures.js";
import { descriptorRef } from "../../src/foundation/messageId.js";
import { commsViolation } from "../../src/foundation/commsViolation.js";

describe("CommsPeerService", () => {
  it("resolves registered peer", async () => {
    const descriptor = buildTestPeerDescriptor();
    const directory = {
      resolve: async (ref: string) => (ref === descriptor.descriptorRef ? descriptor : undefined),
      register: () => undefined,
    };
    const service = new CommsPeerService({
      directory,
      identity: {
        verifyPeer: async () => ({
          ok: false,
          error: commsViolation("identity_unverified", "authenticate", "stub"),
        }),
      },
      endpointPolicy: { assertEndpointAllowed: () => ({ ok: true, value: undefined }) },
    });
    const result = await service.resolvePeer(descriptorRef(descriptor.descriptorRef as string));
    expect(result.ok).toBe(true);
  });

  it("returns not found for missing peer", async () => {
    const service = new CommsPeerService({
      directory: { resolve: async () => undefined, register: () => undefined },
      identity: {
        verifyPeer: async () => ({
          ok: false,
          error: commsViolation("identity_unverified", "authenticate", "stub"),
        }),
      },
      endpointPolicy: { assertEndpointAllowed: () => ({ ok: true, value: undefined }) },
    });
    const result = await service.resolvePeer(descriptorRef("missing"));
    expect(result.ok).toBe(false);
  });

  it("negotiates compatible wire version", () => {
    const service = new CommsPeerService({
      directory: { resolve: async () => undefined, register: () => undefined },
      identity: {
        verifyPeer: async () => ({
          ok: false,
          error: commsViolation("identity_unverified", "authenticate", "stub"),
        }),
      },
      endpointPolicy: { assertEndpointAllowed: () => ({ ok: true, value: undefined }) },
    });
    const result = service.negotiateCompatibility(buildTestPeerDescriptor());
    expect(result.compatibility).toBe("ready");
    expect(result.negotiatedWireVersion).toBe(1);
  });

  it("reports incompatible wire version", () => {
    const service = new CommsPeerService({
      directory: { resolve: async () => undefined, register: () => undefined },
      identity: {
        verifyPeer: async () => ({
          ok: false,
          error: commsViolation("identity_unverified", "authenticate", "stub"),
        }),
      },
      endpointPolicy: { assertEndpointAllowed: () => ({ ok: true, value: undefined }) },
    });
    const result = service.negotiateCompatibility(
      buildTestPeerDescriptor({ supportedWireVersions: [99 as never] }),
    );
    expect(result.compatibility).toBe("incompatible");
  });
});
