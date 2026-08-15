import { describe, expect, it } from "vitest";
import {
  parseCommunicationWireFrame,
  encodeCommunicationWireFrame,
} from "../../src/codec/strictWireCodec.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";

describe("strictWireCodec branches", () => {
  it("rejects unsupported registry version", () => {
    const envelope = buildTestEnvelope();
    const bytes = encodeCommunicationWireFrame(envelope);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    json.registryVersion = 99;
    const decoded = parseCommunicationWireFrame(new TextEncoder().encode(JSON.stringify(json)));
    expect(decoded.ok).toBe(false);
  });

  it("rejects unknown operation code", () => {
    const envelope = buildTestEnvelope();
    const bytes = encodeCommunicationWireFrame(envelope);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    json.operationCode = "not-a-real-operation";
    const decoded = parseCommunicationWireFrame(new TextEncoder().encode(JSON.stringify(json)));
    expect(decoded.ok).toBe(false);
  });

  it("rejects invalid payload classification", () => {
    const envelope = buildTestEnvelope();
    const bytes = encodeCommunicationWireFrame(envelope);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    json.payload.classification = "top-secret";
    const decoded = parseCommunicationWireFrame(new TextEncoder().encode(JSON.stringify(json)));
    expect(decoded.ok).toBe(false);
  });
});
