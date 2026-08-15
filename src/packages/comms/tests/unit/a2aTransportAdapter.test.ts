import { describe, expect, it } from "vitest";
import { A2ATransportAdapter } from "../../src/transports/a2a/a2aTransportAdapter.js";
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

describe("A2ATransportAdapter", () => {
  it("dispatches when sendFrame configured", async () => {
    const sent: Uint8Array[] = [];
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "https://agent.example/a2a",
      sendFrame: async (_endpoint, frame) => {
        sent.push(frame);
        return { ok: true, value: undefined };
      },
    });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope({ messageId: "msg-a2a-001" as never }),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await adapter.dispatch(verified);
    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("rejects dispatch without sendFrame handler", async () => {
    const adapter = new A2ATransportAdapter({ remoteEndpoint: "https://agent.example/a2a" });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await adapter.dispatch(verified);
    expect(result.ok).toBe(false);
  });

  it("performs handshake when sendFrame configured", async () => {
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "https://agent.example/a2a",
      sendFrame: async () => ({ ok: true, value: undefined }),
    });
    const sid = sessionId("session-a2a-hs");
    const result = await adapter.handshake({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-1" as never,
      transcriptDigest: "digest-hs",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-a2a"),
        occurrenceId: occurrenceId("occ-a2a"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
  });
});
