import { describe, expect, it } from "vitest";
import { parseCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { encodeCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";

function mutateEnvelope(mutator: (json: Record<string, unknown>) => void) {
  const envelope = buildTestEnvelope();
  const bytes = encodeCommunicationWireFrame(envelope);
  const json = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  mutator(json);
  return parseCommunicationWireFrame(new TextEncoder().encode(JSON.stringify(json)));
}

describe("strictWireCodec parse errors", () => {
  it("rejects non-object frame", () => {
    const result = parseCommunicationWireFrame(new TextEncoder().encode(JSON.stringify("array")));
    expect(result.ok).toBe(false);
  });

  it("rejects missing messageId", () => {
    const result = mutateEnvelope((json) => {
      delete json.messageId;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid metadata object", () => {
    const result = mutateEnvelope((json) => {
      json.metadata = "bad";
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown metadata field", () => {
    const result = mutateEnvelope((json) => {
      (json.metadata as Record<string, unknown>).extra = true;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid sender actor", () => {
    const result = mutateEnvelope((json) => {
      json.sender = { actorId: "a" };
    });
    expect(result.ok).toBe(false);
  });

  it("rejects integrity digest mismatch", () => {
    const result = mutateEnvelope((json) => {
      json.integrityDigest = "bad-digest";
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid ackMode", () => {
    const result = mutateEnvelope((json) => {
      json.ackMode = "not-a-mode";
    });
    expect(result.ok).toBe(false);
  });
});
