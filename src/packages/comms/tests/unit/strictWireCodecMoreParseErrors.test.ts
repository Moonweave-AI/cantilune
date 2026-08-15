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

describe("strictWireCodec additional parse errors", () => {
  it("rejects sequence below 1", () => {
    const result = mutateEnvelope((json) => {
      json.sequence = 0;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing channelId", () => {
    const result = mutateEnvelope((json) => {
      delete json.channelId;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing channelGeneration", () => {
    const result = mutateEnvelope((json) => {
      delete json.channelGeneration;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing issuedAt", () => {
    const result = mutateEnvelope((json) => {
      delete json.issuedAt;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing expiresAt", () => {
    const result = mutateEnvelope((json) => {
      delete json.expiresAt;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing integrityDigest", () => {
    const result = mutateEnvelope((json) => {
      delete json.integrityDigest;
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid recipient actor", () => {
    const result = mutateEnvelope((json) => {
      json.recipient = { kind: "human" };
    });
    expect(result.ok).toBe(false);
  });
});
