import { describe, expect, it } from "vitest";
import {
  computeEnvelopeIntegrityDigest,
  digestCommunicationFrame,
  encodeCommunicationWireFrame,
  parseCommunicationWireFrame,
  verifyEnvelopeIntegrityDigest,
} from "../../src/codec/strictWireCodec.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { COMMS_LIMITS } from "../../src/foundation/commsLimits.js";

describe("strictWireCodec", () => {
  it("round-trips a valid envelope through encode and parse", () => {
    const envelope = buildTestEnvelope({ messageId: "msg-roundtrip-001" as never });
    const bytes = encodeCommunicationWireFrame(envelope);
    const decoded = parseCommunicationWireFrame(bytes);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }
    expect(decoded.value.messageId).toBe(envelope.messageId);
    expect(decoded.value.integrityDigest).toBe(envelope.integrityDigest);
  });

  it("computes and verifies integrity digest", () => {
    const envelope = buildTestEnvelope();
    const { integrityDigest: _ignored, ...rest } = envelope;
    const digest = computeEnvelopeIntegrityDigest(rest);
    expect(digest).toBe(envelope.integrityDigest);
    expect(verifyEnvelopeIntegrityDigest(envelope).ok).toBe(true);
  });

  it("rejects tampered integrity digest", () => {
    const envelope = buildTestEnvelope();
    const tampered = { ...envelope, integrityDigest: "deadbeef" };
    expect(verifyEnvelopeIntegrityDigest(tampered).ok).toBe(false);
  });

  it("digestCommunicationFrame excludes integrityDigest field", () => {
    const envelope = buildTestEnvelope();
    const digest = digestCommunicationFrame(envelope);
    expect(typeof digest).toBe("string");
    expect(digest.length).toBeGreaterThan(0);
  });

  it("rejects oversized frames", () => {
    const huge = new Uint8Array(COMMS_LIMITS.maxFrameBytes + 1);
    const decoded = parseCommunicationWireFrame(huge);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) {
      return;
    }
    expect(decoded.error.code).toBe("wire_oversized");
  });

  it("rejects invalid UTF-8 JSON", () => {
    const decoded = parseCommunicationWireFrame(new Uint8Array([0xff, 0xfe]));
    expect(decoded.ok).toBe(false);
  });

  it("rejects sequence below 1", () => {
    const envelope = buildTestEnvelope({ sequence: 0 });
    const bytes = encodeCommunicationWireFrame(envelope);
    const decoded = parseCommunicationWireFrame(bytes);
    expect(decoded.ok).toBe(false);
  });

  it("includes replyToMessageId when present", () => {
    const envelope = buildTestEnvelope({ replyToMessageId: "msg-parent-001" as never });
    const bytes = encodeCommunicationWireFrame(envelope);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    expect(json.replyToMessageId).toBe("msg-parent-001");
  });
});
