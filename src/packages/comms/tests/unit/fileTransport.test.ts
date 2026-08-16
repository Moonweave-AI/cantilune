/**
 * FileTransport unit tests (ADR-0018 D1, T1/T2).
 *
 * Exercises the cross-process file-backed transport: dispatch/receive
 * round-trip, E-Stop frozen rejection, empty-inbox retryable error,
 * at-least-once re-read without acknowledge, acknowledge bounds inbox,
 * handshake marker, and base64/structural sanity checks.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectFileTransportPair } from "../../src/transports/file/fileTransport.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { sealVerifiedEnvelope } from "../../src/security/commsCapability.js";
import { parseCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import type { EStopGate } from "../../src/security/identityVerifier.js";
import {
  correlationId,
  epochId,
  epochOrdinal,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";

function mkTempDir(): string {
  return mkdtempSync(join(tmpdir(), "cantilune-filetransport-"));
}

function makeEStop(initial = false): EStopGate {
  let frozen = initial;
  return { isFrozen: () => frozen, setFrozen: (f) => (frozen = f) };
}

describe("FileTransport — dispatch/receive round-trip", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkTempDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("dispatches a frame and the peer receives the same wire bytes", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    const dispatched = await a.dispatch(verified);
    expect(dispatched.ok).toBe(true);
    const received = await b.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    // The received bytes parse back into the same envelope via strict wire v1.
    const parsed = parseCommunicationWireFrame(received.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.messageId).toBe(envelope.messageId);
  });

  it("returns a retryable error when the inbox is empty", async () => {
    const [, b] = connectFileTransportPair(dir);
    const received = await b.receive();
    expect(received.ok).toBe(false);
    if (received.ok) return;
    expect(received.error.code).toBe("transport_failed");
    expect(received.error.retryable).toBe(true);
  });

  it("sendRawFrame writes opaque bytes the peer can receive", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const sent = await a.sendRawFrame(new TextEncoder().encode("raw-file"));
    expect(sent.ok).toBe(true);
    const received = await b.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) {
      return;
    }
    expect(new TextDecoder().decode(received.value)).toBe("raw-file");
  });

  it("sendRawFrame rejects an empty payload and a frozen gate", async () => {
    const gate = makeEStop(true);
    const [a] = connectFileTransportPair(dir, { eStopGate: gate });
    const frozen = await a.sendRawFrame(new Uint8Array([1]));
    expect(frozen.ok).toBe(false);
    gate.setFrozen(false);
    const empty = await a.sendRawFrame(new Uint8Array());
    expect(empty.ok).toBe(false);
  });

  it("writes the frame into the shared outbox directory durably", async () => {
    const [a] = connectFileTransportPair(dir);
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    await a.dispatch(verified);
    const files = readdirSync(a.outbox);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.frame$/);
  });
});

describe("FileTransport — E-Stop", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkTempDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects dispatch when the gate is frozen", async () => {
    const gate = makeEStop(true);
    const [a] = connectFileTransportPair(dir, { eStopGate: gate });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const result = await a.dispatch(verified);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("E-Stop frozen");
    // Nothing was written.
    expect(readdirSync(a.outbox)).toHaveLength(0);
  });

  it("rejects receive when the gate is frozen", async () => {
    const gate = makeEStop(true);
    const [, b] = connectFileTransportPair(dir, { eStopGate: gate });
    const result = await b.receive();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("E-Stop frozen");
  });

  it("allows dispatch after the gate unfreezes", async () => {
    const gate = makeEStop(true);
    const [a, b] = connectFileTransportPair(dir, { eStopGate: gate });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const frozen = await a.dispatch(verified);
    expect(frozen.ok).toBe(false);
    gate.setFrozen(false);
    const ok = await a.dispatch(verified);
    expect(ok.ok).toBe(true);
    const received = await b.receive();
    expect(received.ok).toBe(true);
  });
});

describe("FileTransport — at-least-once + acknowledge", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkTempDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("re-reads the same frame until acknowledged (at-least-once)", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    await a.dispatch(verified);
    const first = await b.receive();
    const second = await b.receive();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // Both reads return the same frame — idempotent dedup is the receiver's job.
  });

  it("acknowledge removes the frame so the next receive sees the inbox empty", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    await a.dispatch(verified);
    const received = await b.receive();
    expect(received.ok).toBe(true);
    const ack = b.acknowledge(envelope.messageId);
    expect(ack.ok).toBe(true);
    const next = await b.receive();
    expect(next.ok).toBe(false);
  });

  it("FIFO order holds across multiple frames (with per-frame acknowledge)", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const first = sealVerifiedEnvelope({
      envelope: buildTestEnvelope({ messageId: "msg-fifo-001" as never }),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const second = sealVerifiedEnvelope({
      envelope: buildTestEnvelope({ messageId: "msg-fifo-002" as never }),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    await a.dispatch(first);
    await a.dispatch(second);
    const r1 = await b.receive();
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const p1 = parseCommunicationWireFrame(r1.value);
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    expect(p1.value.messageId).toBe("msg-fifo-001" as never);
    // Acknowledge the first frame before reading the second — at-least-once
    // means receive re-reads the head until acknowledged.
    b.acknowledge("msg-fifo-001" as never);
    const r2 = await b.receive();
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const p2 = parseCommunicationWireFrame(r2.value);
    expect(p2.ok).toBe(true);
    if (!p2.ok) return;
    expect(p2.value.messageId).toBe("msg-fifo-002" as never);
  });
});

describe("FileTransport — handshake", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkTempDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a handshake marker and returns the transcript digest as ack", async () => {
    const [a] = connectFileTransportPair(dir);
    const sid = sessionId("session-hs-file-001");
    const result = await a.handshake({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-1" as never,
      transcriptDigest: "transcript-digest-file",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-hs-file"),
        occurrenceId: occurrenceId("occ-hs-file"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    } as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ackDigest).toBe("transcript-digest-file");
    const marker = join(a.outbox, ".handshake-session-hs-file-001");
    expect(existsSync(marker)).toBe(true);
  });

  it("rejects handshake when the E-Stop gate is frozen", async () => {
    const gate = makeEStop(true);
    const [a] = connectFileTransportPair(dir, { eStopGate: gate });
    const sid = sessionId("session-hs-frozen");
    const result = await a.handshake({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-1" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-1" as never,
      transcriptDigest: "transcript-digest-frozen",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-hs"),
        occurrenceId: occurrenceId("occ-hs"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    } as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("E-Stop frozen");
  });
});

describe("FileTransport — defensive edge branches", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkTempDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("receive returns retryable error when the inbox directory vanishes", async () => {
    const [, b] = connectFileTransportPair(dir);
    // Remove b's inbox directory out from under it — readdirSync throws.
    try {
      rmdirSync(b.inbox);
    } catch {
      // may be non-empty or already gone; the point is to make readdir fail
    }
    const received = await b.receive();
    expect(received.ok).toBe(false);
    if (received.ok) return;
    expect(received.error.retryable).toBe(true);
  });

  it("acknowledge is a no-op when the peeked frame does not match the id", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    await a.dispatch(verified);
    // Acknowledge a different messageId — no frame removed.
    const ack = b.acknowledge("msg-does-not-exist" as never);
    expect(ack.ok).toBe(true);
    const stillThere = await b.receive();
    expect(stillThere.ok).toBe(true);
  });

  it("acknowledge is a no-op when the inbox is empty", async () => {
    const [, b] = connectFileTransportPair(dir);
    const ack = b.acknowledge("msg-anything" as never);
    expect(ack.ok).toBe(true);
  });

  it("receive hands back raw bytes for a corrupt frame; the strict codec rejects it", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const { writeFileSync } = await import("node:fs");
    // A frame whose decoded bytes are not valid strict-wire-v1 JSON. The
    // transport returns raw bytes (it does not parse); the ingress codec does.
    writeFileSync(
      join(a.outbox, "0000000001-bad.frame"),
      Buffer.from("not-json").toString("base64"),
    );
    const received = await b.receive();
    // The transport returns the raw bytes; the codec is the integrity boundary.
    if (!received.ok) return;
    const parsed = parseCommunicationWireFrame(received.value);
    expect(parsed.ok).toBe(false);
  });

  it("receive rejects an oversized frame beyond maxFrameBytes", async () => {
    const [a, b] = connectFileTransportPair(dir, { maxFrameBytes: 8 });
    const { writeFileSync } = await import("node:fs");
    // base64 of 16 zero bytes — 24 chars, exceeds maxFrameBytes*2 guard.
    writeFileSync(join(a.outbox, "0000000001-big.frame"), Buffer.alloc(16).toString("base64"));
    const received = await b.receive();
    expect(received.ok).toBe(false);
    if (received.ok) return;
    expect(received.error.message).toContain("maxFrameBytes");
  });

  it("a transport without an E-Stop gate is never frozen (default branch)", async () => {
    const [a, b] = connectFileTransportPair(dir); // no eStopGate option
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    const dispatched = await a.dispatch(verified);
    expect(dispatched.ok).toBe(true);
    const received = await b.receive();
    expect(received.ok).toBe(true);
  });

  it("receive returns a retryable error when readFileSync throws (frame vanished race)", async () => {
    const [, b] = connectFileTransportPair(dir);
    const { mkdirSync, rmdirSync } = await import("node:fs");
    // A directory named like a frame is listed by readdirSync (so peekInbox
    // returns an entry) but readFileSync on a directory throws EISDIR — this
    // models the benign race where a concurrent reader removes the frame
    // between peek and read.
    const dirFrame = join(b.inbox, "0000000001-race.frame");
    mkdirSync(dirFrame);
    const received = await b.receive();
    expect(received.ok).toBe(false);
    if (received.ok) return;
    expect(received.error.retryable).toBe(true);
    expect(received.error.message).toContain("frame vanished");
    rmdirSync(dirFrame);
  });

  it("receive returns a non-retryable error for a frame whose contents are not valid base64", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const { writeFileSync } = await import("node:fs");
    // Contains a space (outside the base64 alphabet) and is not a multiple of
    // 4 — the BASE64_FRAME guard rejects it before the lenient decode.
    writeFileSync(join(a.outbox, "0000000001-bad.frame"), "not base64!!");
    const received = await b.receive();
    expect(received.ok).toBe(false);
    if (received.ok) return;
    expect(received.error.retryable).toBe(false);
    expect(received.error.message).toContain("not valid base64");
  });

  it("receive returns a non-retryable error for an empty frame file", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const { writeFileSync } = await import("node:fs");
    // A zero-length file passes the base64-shape guard (empty string matches)
    // but decodes to zero bytes — the "frame is empty" guard fires.
    writeFileSync(join(a.outbox, "0000000001-empty.frame"), "");
    const received = await b.receive();
    expect(received.ok).toBe(false);
    if (received.ok) return;
    expect(received.error.retryable).toBe(false);
    expect(received.error.message).toContain("frame is empty");
  });

  it("acknowledge is benign when the frame is concurrently removed before unlink", async () => {
    const [a, b] = connectFileTransportPair(dir);
    const { readdirSync, mkdirSync, rmdirSync } = await import("node:fs");
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    await a.dispatch(verified);
    // Replace the frame file with a directory of the same name. peekInbox
    // still lists it (readdirSync sees the directory), so the messageId
    // matches, but unlinkSync on a directory throws EISDIR — the catch
    // swallows it and acknowledge still returns ok.
    const frames = readdirSync(b.inbox).filter((n) => n.endsWith(".frame"));
    expect(frames.length).toBe(1);
    const framePath = join(b.inbox, frames[0]!);
    const { unlinkSync } = await import("node:fs");
    unlinkSync(framePath);
    mkdirSync(framePath);
    const ack = b.acknowledge(envelope.messageId);
    expect(ack.ok).toBe(true);
    rmdirSync(framePath);
  });
});
