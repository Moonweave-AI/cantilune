import { describe, expect, it, vi } from "vitest";
import { actorRef, correlationId, idempotencyKey, occurrenceId, sessionId } from "@cantilune/core";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import type { IngressTransportContext } from "../../src/engine/commsIngress.js";
import { parseCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import { isCommunicationOperationCode } from "../../src/protocol/communicationOperationRegistry.js";
import { HmacIdentityVerifier } from "../../src/security/hmacIdentityVerifier.js";
import { sealTestAuthContext } from "../support/commsTestHelpers.js";
import type { PeerDescriptor } from "../../src/peer/peerDescriptor.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";

describe("security regression — stop-ship anti-patterns", () => {
  it("rejects minimal wire frame before identity/authorizer run", async () => {
    const identity = { verifyPeer: vi.fn() };
    const authorizer = { authorize: vi.fn() };
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: { isController: () => true, isMember: () => true },
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      identity,
      authorizer,
    });

    const frame = new TextEncoder().encode(JSON.stringify({ wireVersion: 1 }));
    const ctx: IngressTransportContext = {
      transport: "loopback",
      tlsVerified: true,
      peerDescriptor: {
        descriptorRef: "desc-1" as never,
        runtimeInstanceId: "rt-1" as never,
        digest: "d" as never,
        actors: [actorRef("human-1" as never, "human")],
        endpoints: [],
      } as unknown as IngressTransportContext["peerDescriptor"],
      credentialRef: "cred",
      channelBindingMaterial: "n|2026-08-11T16:00:00Z|00",
    };
    const result = await services.ingress.acceptInboundFrame(frame, ctx);
    expect(result.ok).toBe(false);
    expect(identity.verifyPeer).not.toHaveBeenCalled();
    expect(authorizer.authorize).not.toHaveBeenCalled();
  });

  it("rejects sender/principal mismatch on outbound send", async () => {
    const [transport] = LoopbackTransport.connectPair();
    const services = createCommsServices({
      mode: "test",
      transport,
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: {
        isController: () => true,
        isMember: (_session, actor) => actor.actorId === "human-1" || actor.actorId === "coder-c",
      },
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
    });
    const context = sealTestAuthContext({
      peer: {
        runtimeInstanceId: "rt-1" as never,
        principal: actorRef("human-1" as never, "human"),
        descriptorRef: "desc-1" as never,
        descriptorDigest: "d",
        authenticationMethod: "test",
        channelBindingDigest: "b",
        evidenceRef: "e",
        authenticatedAt: "2026-08-11T16:00:00Z",
        expiresAt: "2026-08-11T17:00:00Z",
      },
      roles: ["session-member"],
    });
    const sent = await services.messaging.send(
      context,
      {
        wireVersion: 1 as never,
        registryVersion: 1 as never,
        messageId: "msg-spoof-001" as never,
        operationCode: "send",
        metadata: {
          epochId: "42" as never,
          epochOrdinal: 1 as never,
          operationTemplateRef: { operationTypeId: "send", revision: "1" },
          sessionId: sessionId("session-spoof-001"),
          correlationId: correlationId("corr-spoof-001"),
          occurrenceId: occurrenceId("occ-spoof-001"),
        },
        sender: actorRef("mallory" as never, "human"),
        recipient: actorRef("coder-c" as never, "agent"),
        channelId: "ch-1" as never,
        channelGeneration: 1 as never,
        sequence: 1,
        payload: {
          contentRef: "content://x" as never,
          contentDigest: "d" as never,
          mediaType: "application/json",
          byteLength: 1,
          classification: "internal",
        },
        ackMode: "durablyAccepted",
        issuedAt: "2026-08-11T16:00:00Z",
        expiresAt: "2026-08-11T17:00:00Z",
        integrityDigest: "bad",
      },
      idempotencyKey("idem-spoof-001"),
    );
    expect(sent.ok).toBe(false);
  });

  it("rejects prototype-chain operation codes", () => {
    expect(isCommunicationOperationCode("__proto__")).toBe(false);
    expect(isCommunicationOperationCode("toString")).toBe(false);
  });

  it("rejects HMAC credential with empty actors", async () => {
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: "secret" }) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });
    const result = await verifier.verifyPeer({
      descriptor: {
        descriptorRef: "desc-empty" as never,
        runtimeInstanceId: "rt-empty" as never,
        digest: "d" as never,
        actors: [],
        endpoints: [],
      } as unknown as PeerDescriptor,
      credentialRef: "cred",
      channelBindingMaterial: "n|2099-01-01T00:00:00Z|00",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unsealed auth context on send", async () => {
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: { isController: () => true, isMember: () => true },
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
    });
    const sent = await services.messaging.send(
      {
        peer: {
          runtimeInstanceId: "rt-1" as never,
          principal: actorRef("human-1" as never, "human"),
          descriptorRef: "desc-1" as never,
          descriptorDigest: "d",
          authenticationMethod: "test",
          channelBindingDigest: "b",
          evidenceRef: "e",
          authenticatedAt: "2026-08-11T16:00:00Z",
          expiresAt: "2026-08-11T17:00:00Z",
        },
        roles: ["session-member"],
      },
      {} as never,
      idempotencyKey("idem-unsealed"),
    );
    expect(sent.ok).toBe(false);
  });

  it("parseCommunicationWireFrame rejects incomplete frames", () => {
    const decoded = parseCommunicationWireFrame(
      new TextEncoder().encode(JSON.stringify({ wireVersion: 1, registryVersion: 1 })),
    );
    expect(decoded.ok).toBe(false);
  });
});
