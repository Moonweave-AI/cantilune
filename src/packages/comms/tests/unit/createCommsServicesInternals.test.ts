import { describe, expect, it } from "vitest";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import {
  buildTestPeerDescriptor,
  defaultTestQuiescence,
  defaultTestSessionAuthority,
  buildTestAuthContext,
} from "../support/envelopeFixtures.js";
import { encodeCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import type { IngressTransportContext } from "../../src/engine/commsIngress.js";

describe("createCommsServices internals via test mode", () => {
  it("mobility allocates fresh endpoints", () => {
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
    });
    const first = services.mobility.allocateFreshEndpoint();
    const second = services.mobility.allocateFreshEndpoint();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(first.value.endpointRef).not.toBe(second.value.endpointRef);
  });

  it("ingress replay protector detects duplicate digest", async () => {
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
      identity: {
        verifyPeer: async () => ({
          ok: true,
          value: buildTestAuthContext().peer,
        }),
      },
    });
    const context: IngressTransportContext = {
      transport: "loopback",
      tlsVerified: true,
      peerDescriptor: buildTestPeerDescriptor(),
      credentialRef: "cred",
      channelBindingMaterial: "binding",
    };
    const bytes = encodeCommunicationWireFrame(
      buildTestEnvelope({ messageId: "msg-replay-int" as never }),
    );
    const first = await services.ingress.acceptInboundFrame(bytes, context);
    expect(first.ok).toBe(true);
    const second = await services.ingress.acceptInboundFrame(bytes, context);
    expect(second.ok).toBe(false);
  });
});
