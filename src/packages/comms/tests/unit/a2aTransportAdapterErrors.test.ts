import { describe, expect, it } from "vitest";
import { A2ATransportAdapter } from "../../src/transports/a2a/a2aTransportAdapter.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { sealVerifiedEnvelope } from "../../src/security/commsCapability.js";
import {
  correlationId,
  epochId,
  epochOrdinal,
  err,
  occurrenceId,
  ok,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { commsViolation } from "../../src/foundation/commsViolation.js";

describe("A2ATransportAdapter errors", () => {
  it("rejects dispatch without sendFrame", async () => {
    const adapter = new A2ATransportAdapter({ remoteEndpoint: "http://agent" });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await adapter.dispatch(verified);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("sendFrame handler not provided");
    }
  });

  it("rejects receive without receiveFrame", async () => {
    const adapter = new A2ATransportAdapter({ remoteEndpoint: "http://agent" });
    const result = await adapter.receive();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("receiveFrame handler not provided");
    }
  });

  it("rejects handshake without sendFrame", async () => {
    const adapter = new A2ATransportAdapter({ remoteEndpoint: "http://agent" });
    const sid = sessionId("session-1");
    const result = await adapter.handshake({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-1" as never,
      transcriptDigest: "digest",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-a2a-err"),
        occurrenceId: occurrenceId("occ-a2a-err"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
  });

  it("propagates sendFrame failure on dispatch", async () => {
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "http://agent",
      sendFrame: async () => err(commsViolation("transport_failed", "send", "network down")),
    });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await adapter.dispatch(verified);
    expect(result.ok).toBe(false);
  });

  it("dispatches successfully when sendFrame configured", async () => {
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "http://agent",
      sendFrame: async () => ok(undefined),
    });
    const envelope = buildTestEnvelope({ messageId: "msg-a2a-ok" as never });
    const verified = sealVerifiedEnvelope({
      envelope,
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await adapter.dispatch(verified);
    expect(result.ok).toBe(true);
  });

  it("rejects incompatible profile", async () => {
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "http://agent",
      profile: "a2a/unknown",
      sendFrame: async () => ok(undefined),
    });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await adapter.dispatch(verified);
    expect(result.ok).toBe(false);
  });
});
