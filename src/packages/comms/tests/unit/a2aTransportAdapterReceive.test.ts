import { describe, expect, it } from "vitest";
import { A2ATransportAdapter } from "../../src/transports/a2a/a2aTransportAdapter.js";

describe("A2ATransportAdapter receive", () => {
  it("delegates to receiveFrame when configured", async () => {
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "https://agent.example/a2a",
      receiveFrame: async () => ({ ok: true, value: new TextEncoder().encode("bytes") }),
    });
    const received = await adapter.receive();
    expect(received.ok).toBe(true);
  });

  it("rejects incompatible profile", async () => {
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "https://agent.example/a2a",
      profile: "a2a/9.9",
      sendFrame: async () => ({ ok: true, value: undefined }),
    });
    const result = await adapter.handshake({
      sessionId: "session-a2a-bad" as never,
      authoritativeSnapshotRef: "snap" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep" as never,
      transcriptDigest: "digest",
      authEvidenceRef: "auth",
      metadata: {
        epochId: "42" as never,
        epochOrdinal: 1 as never,
        operationTemplateRef: { operationTypeId: "introduce", revision: "1" },
        sessionId: "session-a2a-bad" as never,
        correlationId: "corr" as never,
        occurrenceId: "occ" as never,
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
  });
});
