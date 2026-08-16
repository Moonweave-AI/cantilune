import { describe, expect, it, afterEach } from "vitest";
import {
  correlationId,
  epochId,
  epochOrdinal,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import {
  NetTransport,
  connectNetTransportPair,
  createNetTransportPair,
} from "../../src/transports/net/netTransport.js";
import { issueSelfSignedMtlsPair } from "../../src/security/mtlsMaterial.js";
import { assertTlsMaterial, NET_TLS_MIN_VERSION } from "../../src/transports/net/netTls.js";
import { buildTestEnvelope } from "../support/envelopeFixtures.js";
import { sealVerifiedEnvelope } from "../../src/security/commsCapability.js";
import { parseCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import { receiveSoon } from "../../src/conformance/a2aConformanceHarness.js";
import type { EStopGate } from "../../src/security/identityVerifier.js";
import type { CommsEventEnvelope } from "../../src/events/commsEvent.js";

function makeEStop(initial = false): EStopGate {
  let frozen = initial;
  return { isFrozen: () => frozen, setFrozen: (next) => (frozen = next) };
}

function handshake(digest: string) {
  const sid = sessionId("session-net-hs");
  return {
    sessionId: sid,
    authoritativeSnapshotRef: "snap-1" as never,
    requester: "rt-req" as never,
    acceptor: "rt-acc" as never,
    offeredProtocols: [],
    endpointRef: "ep-1" as never,
    transcriptDigest: digest,
    authEvidenceRef: "auth",
    metadata: {
      epochId: epochId("42"),
      epochOrdinal: epochOrdinal(1),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
      sessionId: sid,
      correlationId: correlationId("corr-net-hs"),
      occurrenceId: occurrenceId("occ-net-hs"),
    },
    expiresAt: "2099-01-01T00:00:00Z",
  };
}

const openPairs: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  const closing = openPairs.splice(0, openPairs.length);
  await Promise.all(closing.map((pair) => pair.close().catch(() => undefined)));
});

async function openPair(
  options?: Parameters<typeof connectNetTransportPair>[0],
): Promise<[NetTransport, NetTransport]> {
  const pair = await connectNetTransportPair(options);
  openPairs.push(pair[0]);
  return pair;
}

describe("NetTransport construction", () => {
  it("requires TLS PEMs and a pin set (or provenanceUnavailable)", () => {
    expect(NET_TLS_MIN_VERSION).toBe("TLSv1.3");
    expect(() => assertTlsMaterial({ cert: "", key: "k", ca: "c" })).toThrow("non-empty");
    const issued = issueSelfSignedMtlsPair();
    expect(
      () =>
        new NetTransport({
          endpointId: "x",
          tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
          pinnedPeerFingerprints: [],
        }),
    ).toThrow("pinnedPeerFingerprints");
  });

  it("accepts an unpinned session only with provenanceUnavailable", () => {
    const issued = issueSelfSignedMtlsPair();
    const transport = new NetTransport({
      endpointId: "unpinned",
      tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
      pinnedPeerFingerprints: [],
      provenanceUnavailable: true,
    });
    expect(transport.transportId).toBe("net");
  });
});

describe("NetTransport pair — dispatch/receive", () => {
  it("round-trips a sealed envelope over mTLS", async () => {
    const [a, b] = await openPair();
    const envelope = buildTestEnvelope();
    const dispatched = await a.dispatch(
      sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" }),
    );
    expect(dispatched.ok).toBe(true);
    const received = await receiveSoon(b);
    expect(received.ok).toBe(true);
    if (!received.ok) {
      return;
    }
    const parsed = parseCommunicationWireFrame(received.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.value.messageId).toBe(envelope.messageId);
    expect(a.getPeerFingerprint()).toBe(a.getIdentityBinding()?.fingerprint);
    expect(b.getPeerFingerprint()).toBe(b.getIdentityBinding()?.fingerprint);
    expect(a.getPeerFingerprint()).not.toBe(b.getPeerFingerprint());
    expect(a.getIdentityBinding()?.provenanceUnavailable).toBe(false);
    expect(a.getLocalAddress()?.port).toBeGreaterThan(0);
  });

  it("returns a retryable error when the inbox is empty", async () => {
    const [, b] = await openPair();
    const received = await b.receive();
    expect(received.ok).toBe(false);
    if (received.ok) {
      return;
    }
    expect(received.error.retryable).toBe(true);
  });

  it("rejects an unsealed envelope without touching the wire", async () => {
    const [a, b] = await openPair();
    const result = await a.dispatch({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    expect(result.ok).toBe(false);
    const received = await b.receive();
    expect(received.ok).toBe(false);
  });

  it("handshakes and returns the transcript digest", async () => {
    const [a] = await openPair();
    const result = await a.handshake(handshake("transcript-net"));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.ackDigest).toBe("transcript-net");
  });

  it("sendRawFrame delivers opaque bytes to the peer inbox", async () => {
    const [a, b] = await openPair();
    const bytes = new TextEncoder().encode("raw-net");
    const sent = await a.sendRawFrame(bytes);
    expect(sent.ok).toBe(true);
    const received = await receiveSoon(b);
    expect(received.ok).toBe(true);
    if (!received.ok) {
      return;
    }
    expect(new TextDecoder().decode(received.value)).toBe("raw-net");
  });
});

describe("NetTransport — E-Stop", () => {
  it("rejects dispatch, receive, and handshake when frozen", async () => {
    const gate = makeEStop(false);
    const [a, b] = await openPair({ eStopGate: gate });
    gate.setFrozen(true);
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    const dispatched = await a.dispatch(verified);
    expect(dispatched.ok).toBe(false);
    if (!dispatched.ok) {
      expect(dispatched.error.message).toContain("E-Stop frozen");
    }
    const received = await b.receive();
    expect(received.ok).toBe(false);
    const hs = await a.handshake(handshake("frozen"));
    expect(hs.ok).toBe(false);
    const raw = await a.sendRawFrame(new Uint8Array([1]));
    expect(raw.ok).toBe(false);
  });

  it("allows traffic after the gate unfreezes", async () => {
    const gate = makeEStop(false);
    const [a, b] = await openPair({ eStopGate: gate });
    const verified = sealVerifiedEnvelope({
      envelope: buildTestEnvelope(),
      verifiedAt: "2026-08-11T16:00:00Z",
    });
    gate.setFrozen(true);
    expect((await a.dispatch(verified)).ok).toBe(false);
    gate.setFrozen(false);
    expect((await a.dispatch(verified)).ok).toBe(true);
    expect((await receiveSoon(b)).ok).toBe(true);
  });
});

describe("NetTransport — identity E-Stop", () => {
  it("freezes and emits SecurityRejected when the pin does not match", async () => {
    const events: CommsEventEnvelope[] = [];
    const issued = issueSelfSignedMtlsPair();
    const [a, b] = createNetTransportPair({
      material: issued,
      pinnedOverrideA: [issued.ca.fingerprint],
      eventSink: { emit: (event) => events.push(event) },
      readyTimeoutMs: 2_000,
    });
    openPairs.push(a);
    await expect(a.ready()).rejects.toThrow();
    expect(a.isFrozen()).toBe(true);
    expect(events.some((event) => event.kind === "SecurityRejected")).toBe(true);
    const dispatched = await a.dispatch(
      sealVerifiedEnvelope({
        envelope: buildTestEnvelope(),
        verifiedAt: "2026-08-11T16:00:00Z",
      }),
    );
    expect(dispatched.ok).toBe(false);
    await b.close().catch(() => undefined);
  });

  it("records provenanceUnavailable when the pin set is empty and the flag is set", async () => {
    const [a] = await openPair({
      provenanceUnavailable: true,
      pinnedOverrideA: [],
      pinnedOverrideB: [],
    });
    expect(a.getIdentityBinding()?.provenanceUnavailable).toBe(true);
  });
});

describe("NetTransport — close", () => {
  it("fails subsequent operations after close", async () => {
    const [a] = await openPair();
    await a.close();
    const result = await a.dispatch(
      sealVerifiedEnvelope({
        envelope: buildTestEnvelope(),
        verifiedAt: "2026-08-11T16:00:00Z",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("closed");
    }
  });

  it("freezes when a peer frame exceeds maxFrameBytes", async () => {
    const [a, b] = await openPair({ maxFrameBytes: 8, readyTimeoutMs: 3_000 });
    const sent = await a.sendRawFrame(new Uint8Array(64).fill(1));
    expect(sent.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(b.isFrozen()).toBe(true);
  });

  it("listen is idempotent and ready times out when no peer connects", async () => {
    const issued = issueSelfSignedMtlsPair();
    const transport = new NetTransport({
      endpointId: "listen-only",
      tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
      listen: { host: "127.0.0.1", port: 0 },
      pinnedPeerFingerprints: [issued.b.fingerprint],
      readyTimeoutMs: 80,
    });
    const first = await transport.listen();
    const second = await transport.listen();
    expect(second.port).toBe(first.port);
    await expect(transport.ready()).rejects.toThrow("timed out");
    const received = await transport.receive();
    expect(received.ok).toBe(false);
    await transport.close();
    const after = await transport.receive();
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.error.message).toContain("closed");
    }
  });

  it("a refused connect freezes the E-Stop gate", async () => {
    const issued = issueSelfSignedMtlsPair();
    const transport = new NetTransport({
      endpointId: "refused",
      tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
      connect: { host: "127.0.0.1", port: 1 },
      pinnedPeerFingerprints: [issued.b.fingerprint],
      readyTimeoutMs: 500,
    });
    await expect(transport.ready()).rejects.toThrow();
    expect(transport.isFrozen()).toBe(true);
    await transport.close();
  });

  it("ready rejects after close on a listen-only transport", async () => {
    const issued = issueSelfSignedMtlsPair();
    const transport = new NetTransport({
      endpointId: "closed-ready",
      tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
      listen: { host: "127.0.0.1", port: 0 },
      pinnedPeerFingerprints: [issued.b.fingerprint],
      readyTimeoutMs: 200,
    });
    await transport.listen();
    await transport.close();
    await expect(transport.ready()).rejects.toThrow();
    await transport.close();
  });

  it("rejects a late inbound connection after the gate is frozen", async () => {
    const issued = issueSelfSignedMtlsPair();
    const gate = makeEStop(false);
    const [a] = await openPair({ material: issued, eStopGate: gate });
    const addr = a.getLocalAddress();
    expect(addr).toBeDefined();
    if (addr === undefined) {
      return;
    }
    gate.setFrozen(true);
    const late = new NetTransport({
      endpointId: "late",
      tls: { cert: issued.b.cert, key: issued.b.key, ca: issued.ca.cert },
      connect: { host: "127.0.0.1", port: addr.port },
      pinnedPeerFingerprints: [issued.a.fingerprint],
      readyTimeoutMs: 500,
    });
    await late.ready().catch(() => undefined);
    expect(a.isFrozen()).toBe(true);
    await late.close();
  });

  it("connect without an address or provider throws", async () => {
    const issued = issueSelfSignedMtlsPair();
    const transport = new NetTransport({
      endpointId: "no-connect",
      tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
      pinnedPeerFingerprints: [issued.b.fingerprint],
    });
    await expect(transport.connect()).rejects.toThrow("connect");
  });
});
