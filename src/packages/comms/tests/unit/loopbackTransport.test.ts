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
