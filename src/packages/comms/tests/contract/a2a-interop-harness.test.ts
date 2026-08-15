import { describe, expect, it } from "vitest";
import { ok } from "@cantilune/core";
import { A2ATransportAdapter } from "../../src/transports/a2a/a2aTransportAdapter.js";
import { decodeA2AFrame } from "../../src/transports/a2a/a2aCodec.js";
import { wireVersion, registryVersion, messageId } from "../../src/foundation/messageId.js";
import {
  correlationId,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";
import { withIntegrityDigest } from "../support/commsTestHelpers.js";
import { sealVerifiedEnvelope } from "../../src/security/commsCapability.js";

describe("A2A interop harness", () => {
  it("dispatches pinned-profile frames through injectable transport", async () => {
    const sent: Uint8Array[] = [];
    const adapter = new A2ATransportAdapter({
      remoteEndpoint: "https://agent.example/a2a",
      sendFrame: async (_endpoint, frame) => {
        sent.push(frame);
        return ok(undefined);
      },
    });

    const envelope = {
      wireVersion: wireVersion(1),
      registryVersion: registryVersion(1),
      messageId: messageId("msg-a2a-interop-001"),
      operationCode: "send" as const,
      metadata: {
        epochId: "42" as never,
        epochOrdinal: 1 as never,
        operationTemplateRef: operationTemplateRef("send", "1"),
        sessionId: sessionId("session-a2a-001"),
        correlationId: correlationId("corr-a2a-001"),
        occurrenceId: occurrenceId("occ-a2a-001"),
        idempotencyKey: idempotencyKey("idem-a2a-001"),
      },
      sender: { actorId: "a1" as never, kind: "agent" as const },
      recipient: { actorId: "a2" as never, kind: "agent" as const },
      channelId: channelId("channel-a2a-001"),
      channelGeneration: channelGeneration(1),
      sequence: 1,
      payload: {
        contentRef: "content://a2a" as never,
        contentDigest: "digest" as never,
        mediaType: "application/json",
        byteLength: 4,
        classification: "internal" as const,
      },
      ackMode: "durablyAccepted" as const,
      issuedAt: "2026-08-11T16:00:00Z",
      expiresAt: "2026-08-11T17:00:00Z",
    };

    const verified = sealVerifiedEnvelope({
      envelope: withIntegrityDigest(envelope),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await adapter.dispatch(verified);
    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(1);
    const decoded = decodeA2AFrame(sent[0]!);
    expect(decoded.ok).toBe(true);
  });
});
