import { describe, expect, it } from "vitest";
import { idempotencyKey } from "@cantilune/core";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import {
  buildTestAuthContext,
  buildTestEnvelope,
  buildTestPeerDescriptor,
  defaultTestQuiescence,
  defaultTestSessionAuthority,
} from "../support/envelopeFixtures.js";
import type { IngressTransportContext } from "../../src/engine/commsIngress.js";

describe("send-receive loopback integration", () => {
  it("delivers outbound message to peer ingress pipeline", async () => {
    const [local, remote] = LoopbackTransport.connectPair();
    const sender = createCommsServices({
      mode: "test",
      transport: local,
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const receiver = createCommsServices({
      mode: "test",
      transport: remote,
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
      clock: { now: () => "2026-08-11T16:00:00Z" },
      identity: {
        verifyPeer: async () => ({ ok: true, value: buildTestAuthContext().peer }),
      },
      authorizer: { authorize: () => ({ ok: true, value: undefined }) },
    });

    const envelope = buildTestEnvelope({ messageId: "msg-integ-001" as never });
    const sent = await sender.messaging.send(
      buildTestAuthContext(),
      envelope,
      idempotencyKey("idem-integ-001"),
    );
    expect(sent.ok).toBe(true);

    const receivedBytes = await remote.receive();
    expect(receivedBytes.ok).toBe(true);
    if (!receivedBytes.ok) {
      return;
    }

    const ctx: IngressTransportContext = {
      transport: "loopback",
      tlsVerified: true,
      peerDescriptor: buildTestPeerDescriptor(),
      credentialRef: "cred",
      channelBindingMaterial: "n|2026-08-11T16:00:00Z|00",
    };
    const accepted = await receiver.ingress.acceptInboundFrame(receivedBytes.value, ctx);
    expect(accepted.ok).toBe(true);
  });
});
