/**
 * FileTransport a2a/0.1 conformance (ADR-0018 D1).
 *
 * The FileTransport uses the same strict-wire-v1 codec as LoopbackTransport
 * and the A2A adapter, so it inherits the a2a/0.1 conformance profile rather
 * than redefining it. This test pins that inheritance: a frame written by
 * FileTransport is a valid strict-wire-v1 frame that the shared codec parses,
 * carries the registered operation family/code, and respects the wire version.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectFileTransportPair } from "../../src/transports/file/fileTransport.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { sealVerifiedEnvelope } from "../../src/security/commsCapability.js";
import {
  parseCommunicationWireFrame,
  computeEnvelopeIntegrityDigest,
  verifyEnvelopeIntegrityDigest,
} from "../../src/codec/strictWireCodec.js";
import { COMMS_WIRE_VERSION_V1, COMMS_REGISTRY_VERSION_V1, A2A_PROFILE_PINNED } from "../../src/foundation/commsLimits.js";

describe("FileTransport — a2a/0.1 wire v1 conformance", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cantilune-filetransport-conf-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("dispatched frames carry wire version v1 and registry version v1", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    await a.dispatch(verified);
    const received = await b.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    const parsed = parseCommunicationWireFrame(received.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.wireVersion).toBe(COMMS_WIRE_VERSION_V1);
    expect(parsed.value.registryVersion).toBe(COMMS_REGISTRY_VERSION_V1);
  });

  it("the received frame's integrity digest verifies (strict wire v1 integrity)", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    await a.dispatch(verified);
    const received = await b.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    const parsed = parseCommunicationWireFrame(received.value);
    if (!parsed.ok) return;
    const verified2 = verifyEnvelopeIntegrityDigest(parsed.value);
    expect(verified2.ok).toBe(true);
  });

  it("carries a registered operation code (send family)", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const envelope = buildTestEnvelope({ operationCode: "send" });
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    await a.dispatch(verified);
    const received = await b.receive();
    if (!received.ok) return;
    const parsed = parseCommunicationWireFrame(received.value);
    if (!parsed.ok) return;
    expect(parsed.value.operationCode).toBe("send");
  });

  it("uses the same codec round-trip as the pinned a2a/0.1 profile", async () => {
    // The pinned profile string is the conformance anchor; FileTransport does
    // not introduce a distinct profile — it reuses strict wire v1.
    expect(A2A_PROFILE_PINNED).toBe("a2a/0.1");
    const [a, b] = connectFileTransportPair(dir);
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    await a.dispatch(verified);
    const received = await b.receive();
    if (!received.ok) return;
    const parsed = parseCommunicationWireFrame(received.value);
    if (!parsed.ok) return;
    // The integrity digest recomputed from the parsed frame matches the original
    // — proving the FileTransport path is a transparent strict-wire-v1 relay.
    const recomputed = computeEnvelopeIntegrityDigest(parsed.value);
    expect(recomputed).toBe(envelope.integrityDigest);
  });
});
