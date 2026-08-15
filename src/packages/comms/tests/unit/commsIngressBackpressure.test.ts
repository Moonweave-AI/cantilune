import { describe, expect, it } from "vitest";
import { CommsIngress } from "../../src/engine/commsIngress.js";
import type { IngressTransportContext } from "../../src/engine/commsIngress.js";
import { encodeCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import {
  buildTestAuthContext,
  buildTestEnvelope,
  buildTestPeerDescriptor,
} from "../support/envelopeFixtures.js";
import { COMMS_LIMITS } from "../../src/foundation/commsLimits.js";
import type { CommsStore } from "../../src/ports/commsStore.js";

function ingressContext(): IngressTransportContext {
  return {
    transport: "loopback",
    tlsVerified: true,
    peerDescriptor: buildTestPeerDescriptor(),
    credentialRef: "cred-001",
    channelBindingMaterial: "nonce|2026-08-11T16:00:00Z|00",
  };
}

describe("CommsIngress backpressure", () => {
  it("rejects when inbox backlog exceeded", async () => {
    const backlog = Array.from({ length: COMMS_LIMITS.maxInboxBacklog + 1 }, (_, i) => ({
      deliveryId: `del-${i}`,
    }));
    const innerStore = {
      nextSequence: () => 1 as never,
      appendInbox: () => "committed" as const,
      snapshot: () => ({ inbox: backlog, outbox: [], reconnects: new Map(), occurrences: [] }),
    };
    const store = innerStore as unknown as CommsStore;
    const ingress = new CommsIngress({
      store,
      identity: { verifyPeer: async () => ({ ok: true, value: buildTestAuthContext().peer }) },
      authorizer: { authorize: () => ({ ok: true as const, value: undefined }) },
      replay: {
        checkReplay: () => ({ ok: true as const, value: undefined }),
        recordSeen: () => undefined,
      },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events: { emit: () => undefined },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const bytes = encodeCommunicationWireFrame(
      buildTestEnvelope({ messageId: "msg-backpressure" as never }),
    );
    const result = await ingress.acceptInboundFrame(bytes, ingressContext());
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("backpressure");
  });
});
