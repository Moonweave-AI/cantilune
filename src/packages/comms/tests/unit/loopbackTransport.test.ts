import { describe, expect, it } from "vitest";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { sealVerifiedEnvelope } from "../../src/security/commsCapability.js";
import {
  correlationId,
  epochId,
  epochOrdinal,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";

describe("LoopbackTransport", () => {
  it("dispatches and receives between connected pair", async () => {
    const [a, b] = LoopbackTransport.connectPair();
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    const dispatched = await a.dispatch(verified);
    expect(dispatched.ok).toBe(true);
    const received = await b.receive();
    expect(received.ok).toBe(true);
  });

  it("rejects dispatch without peer connection", async () => {
    const transport = new LoopbackTransport();
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await transport.dispatch(verified);
    expect(result.ok).toBe(false);
  });

  it("handshake delivers to peer inbox", async () => {
    const [a, b] = LoopbackTransport.connectPair();
    const sid = sessionId("session-hs-001");
    const handshake = {
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-1" as never,
      transcriptDigest: "transcript-digest",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-hs"),
        occurrenceId: occurrenceId("occ-hs"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    };
    const ack = await a.handshake(handshake);
    expect(ack.ok).toBe(true);
    const received = await b.receive();
    expect(received.ok).toBe(true);
  });

  it("sendRawFrame delivers opaque bytes to the peer", async () => {
    const [a, b] = LoopbackTransport.connectPair();
    const sent = await a.sendRawFrame(new TextEncoder().encode("raw-loop"));
    expect(sent.ok).toBe(true);
    const received = await b.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) {
      return;
    }
    expect(new TextDecoder().decode(received.value)).toBe("raw-loop");
  });

  it("E-Stop rejects dispatch, receive, handshake, and sendRawFrame", async () => {
    let frozen = true;
    const gate = { isFrozen: () => frozen, setFrozen: (next: boolean) => (frozen = next) };
    const [a, b] = LoopbackTransport.connectPair({ eStopGate: gate });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    expect((await a.dispatch(verified)).ok).toBe(false);
    expect((await b.receive()).ok).toBe(false);
    const sid = sessionId("session-hs-estop");
    const hs = await a.handshake({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-1" as never,
      transcriptDigest: "x",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-hs-estop"),
        occurrenceId: occurrenceId("occ-hs-estop"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(hs.ok).toBe(false);
    expect((await a.sendRawFrame(new Uint8Array([1]))).ok).toBe(false);
    frozen = false;
    expect((await a.sendRawFrame(new Uint8Array([1]))).ok).toBe(true);
  });

  it("sendRawFrame rejects without a peer", async () => {
    const transport = new LoopbackTransport();
    const result = await transport.sendRawFrame(new Uint8Array([1]));
    expect(result.ok).toBe(false);
  });

  it("receive returns retryable error on empty inbox", async () => {
    const transport = new LoopbackTransport();
    const result = await transport.receive();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.retryable).toBe(true);
  });
});
