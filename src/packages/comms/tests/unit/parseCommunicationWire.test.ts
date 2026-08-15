import { describe, expect, it } from "vitest";
import { parseCommunicationWireFrame } from "../../src/codec/parseCommunicationWire.js";
import { encodeCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";

describe("parseCommunicationWire re-export", () => {
  it("delegates to strictWireCodec", () => {
    const envelope = buildTestEnvelope();
    const bytes = encodeCommunicationWireFrame(envelope);
    const decoded = parseCommunicationWireFrame(bytes);
    expect(decoded.ok).toBe(true);
  });
});
