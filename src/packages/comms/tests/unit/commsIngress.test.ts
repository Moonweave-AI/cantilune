import { describe, expect, it, vi } from "vitest";
import { CommsIngress } from "../../src/engine/commsIngress.js";
import type { CommsIngressDeps, IngressTransportContext } from "../../src/engine/commsIngress.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import { encodeCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import {
  buildTestAuthContext,
  buildTestEnvelope,
  buildTestPeerDescriptor,
} from "../support/envelopeFixtures.js";
import { actorRef, idempotencyKey } from "@cantilune/core";

function buildIngressDeps(overrides?: Partial<CommsIngressDeps>) {
  const store = new MemoryCommsStore();
  const events = {
    events: [] as unknown[],
    emit(event: unknown) {
      this.events.push(event);
    },
  };
  const replaySeen = new Set<string>();
  return {
    store,
    events,
    ingress: new CommsIngress({
      store,
      identity: {
        verifyPeer: async () => okPeer(buildTestAuthContext().peer),
      },
      authorizer: { authorize: () => ({ ok: true as const, value: undefined }) },
      replay: {
        checkReplay: ({ messageDigest }) =>
          replaySeen.has(messageDigest)
            ? {
                ok: false as const,
                error: {
                  code: "replay_detected",
                  phase: "ingress",
                  message: "dup",
                  retryable: false,
                },
              }
            : { ok: true as const, value: undefined },
        recordSeen: (digest) => {
          replaySeen.add(digest);
        },
      },
      eStop: { isFrozen: () => false, setFrozen: () => undefined },
      events,
      clock: { now: () => "2026-08-11T16:00:00Z" },
      ...overrides,
    }),
  };
}

function okPeer(peer: ReturnType<typeof buildTestAuthContext>["peer"]) {
  return { ok: true as const, value: peer };
}

function ingressContext(): IngressTransportContext {
  return {
    transport: "loopback",
    tlsVerified: true,
    peerDescriptor: buildTestPeerDescriptor(),
    credentialRef: "cred-001",
    channelBindingMaterial: "nonce|2026-08-11T16:00:00Z|00",
  };
}

describe("CommsIngress", () => {
  it("accepts valid inbound frame end-to-end", async () => {
    const { ingress } = buildIngressDeps();
    const envelope = buildTestEnvelope();
    const bytes = encodeCommunicationWireFrame(envelope);
    const result = await ingress.acceptInboundFrame(bytes, ingressContext());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.inboxResult).toBe("committed");
  });

  it("rejects non-Uint8Array input", async () => {
    const { ingress } = buildIngressDeps();
    const result = await ingress.acceptInboundFrame("not-bytes", ingressContext());
    expect(result.ok).toBe(false);
  });

  it("rejects missing transport binding context", async () => {
    const { ingress } = buildIngressDeps();
    const bytes = encodeCommunicationWireFrame(buildTestEnvelope());
    const result = await ingress.acceptInboundFrame(bytes, { transport: "loopback" });
    expect(result.ok).toBe(false);
  });

  it("rejects when E-Stop active", async () => {
    const { ingress } = buildIngressDeps({
      eStop: { isFrozen: () => true, setFrozen: () => undefined },
    });
    const result = await ingress.acceptInboundFrame(
      encodeCommunicationWireFrame(buildTestEnvelope()),
      ingressContext(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("comms_frozen");
  });

  it("rejects expired envelope", async () => {
    const { ingress } = buildIngressDeps({
      clock: { now: () => "2099-06-01T00:00:00Z" },
    });
    const envelope = buildTestEnvelope({ expiresAt: "2020-01-01T00:00:00Z" });
    const result = await ingress.acceptInboundFrame(
      encodeCommunicationWireFrame(envelope),
      ingressContext(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("wire_expired");
  });

  it("rejects sender/principal mismatch", async () => {
    const { ingress } = buildIngressDeps();
    const envelope = buildTestEnvelope({
      sender: actorRef("mallory" as never, "human"),
    });
    const result = await ingress.acceptInboundFrame(
      encodeCommunicationWireFrame(envelope),
      ingressContext(),
    );
    expect(result.ok).toBe(false);
  });

  it("invokes runtime consumer on committed inbox", async () => {
    const consume = vi.fn(async () => ({ ok: true as const, value: undefined }));
    const { ingress } = buildIngressDeps({ runtimeConsumer: { consume } });
    await ingress.acceptInboundFrame(
      encodeCommunicationWireFrame(buildTestEnvelope()),
      ingressContext(),
    );
    expect(consume).toHaveBeenCalledOnce();
  });

  it("rejects duplicate frame digest as replay", async () => {
    const { ingress } = buildIngressDeps();
    const envelope = buildTestEnvelope({
      metadata: {
        ...buildTestEnvelope().metadata,
        idempotencyKey: idempotencyKey("idem-dup-001"),
      },
    });
    const ctx = ingressContext();
    const bytes = encodeCommunicationWireFrame(envelope);
    const first = await ingress.acceptInboundFrame(bytes, ctx);
    const second = await ingress.acceptInboundFrame(bytes, ctx);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.error.code).toBe("replay_detected");
  });
});
