/**
 * NetTransport (ADR-0018 T3) — cross-host `CommunicationTransport` over
 * TCP + TLS 1.3 + mTLS. Same port as LoopbackTransport / FileTransport:
 * Runtime remains the sole collaboration mutator; this class moves strict
 * wire-v1 bytes (payload by `ContentRef` only) and never writes the world.
 *
 * Identity: after the TLS handshake, `EndpointIdentityVerifier` checks the
 * peer certificate SHA-256 fingerprint against the receipt pin set. A miss
 * (or a TLS failure) freezes the E-Stop gate, emits `SecurityRejected`, and
 * leaves any unsent local work untouched (safe state is non-destructive).
 */
import { createServer, connect as tlsConnect, type Server, type TLSSocket } from "node:tls";
import { type Result, err, ok } from "@cantilune/core";
import { type CommunicationTransport } from "../../ports/communicationTransport.js";
import { type VerifiedEnvelope } from "../../envelope/communicationEnvelope.js";
import { type SessionHandshake } from "../../session/sessionTransportBinding.js";
import { commsViolation, type CommsViolation } from "../../foundation/commsViolation.js";
import { COMMS_LIMITS } from "../../foundation/commsLimits.js";
import { encodeCommunicationWireFrame } from "../../codec/strictWireCodec.js";
import { assertVerifiedEnvelope } from "../../security/commsCapability.js";
import {
  createMtlsEndpointIdentityVerifier,
  type EndpointIdentityVerifier,
  type EndpointIdentityVerification,
} from "../../security/endpointIdentityVerifier.js";
import { issueSelfSignedMtlsPair, type IssuedMtlsPair } from "../../security/mtlsMaterial.js";
import type { EStopGate } from "../../security/identityVerifier.js";
import {
  encodeNetFrame,
  pushNetBytes,
  NET_FRAME_TYPE_ENVELOPE,
  NET_FRAME_TYPE_HANDSHAKE,
  type NetFrameParseState,
} from "./netFrame.js";
import {
  assertTlsMaterial,
  buildClientTlsOptions,
  buildServerTlsOptions,
  extractPeerFingerprint,
  type NetTransportTlsMaterial,
} from "./netTls.js";
import { emitNetTransportEvent, type NetTransportEventSink } from "./netEvents.js";

export interface NetListenAddress {
  readonly host: string;
  readonly port: number;
}

export interface NetTransportOptions {
  readonly endpointId: string;
  readonly tls: NetTransportTlsMaterial;
  readonly listen?: NetListenAddress;
  readonly connect?: NetListenAddress;
  readonly pinnedPeerFingerprints: readonly string[];
  readonly expectedPeerActorRef?: string;
  readonly identityVerifier?: EndpointIdentityVerifier;
  readonly eStopGate?: EStopGate;
  readonly maxFrameBytes?: number;
  readonly eventSink?: NetTransportEventSink;
  readonly provenanceUnavailable?: boolean;
  readonly readyTimeoutMs?: number;
  readonly peerConnectProvider?: () => Promise<NetListenAddress>;
  readonly onListening?: (addr: NetListenAddress) => void;
}

interface SocketWaiter {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

function createInternalEStop(): EStopGate {
  let frozen = false;
  return {
    isFrozen: () => frozen,
    setFrozen: (next) => {
      frozen = next;
    },
  };
}

type NetMutablePhase = "send" | "receive" | "session";

function frozenViolation(phase: NetMutablePhase): CommsViolation {
  return commsViolation("transport_failed", phase, "E-Stop frozen", {
    retryable: phase === "receive",
  });
}

function transportFailed(phase: NetMutablePhase, message: string): CommsViolation {
  return commsViolation("transport_failed", phase, message, { retryable: phase === "receive" });
}

class PortExchange {
  private readonly ports = new Map<string, NetListenAddress>();
  private readonly waiters = new Map<string, Array<(addr: NetListenAddress) => void>>();

  publish(side: string, addr: NetListenAddress): void {
    this.ports.set(side, addr);
    const pending = this.waiters.get(side) ?? [];
    this.waiters.delete(side);
    for (const resolve of pending) {
      resolve(addr);
    }
  }

  wait(side: string): Promise<NetListenAddress> {
    const existing = this.ports.get(side);
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }
    return new Promise((resolve) => {
      const list = this.waiters.get(side) ?? [];
      list.push(resolve);
      this.waiters.set(side, list);
    });
  }
}

export class NetTransport implements CommunicationTransport {
  readonly transportId = "net";
  private readonly endpointId: string;
  private readonly tls: NetTransportTlsMaterial;
  private readonly listenOpts: NetListenAddress | undefined;
  private readonly connectOpts: NetListenAddress | undefined;
  private readonly pinnedPeerFingerprints: readonly string[];
  private readonly expectedPeerActorRef: string;
  private readonly identityVerifier: EndpointIdentityVerifier;
  private readonly eStopGate: EStopGate;
  private readonly maxFrameBytes: number;
  private readonly eventSink: NetTransportEventSink | undefined;
  private readonly provenanceUnavailable: boolean;
  private readonly readyTimeoutMs: number;
  private readonly peerConnectProvider: (() => Promise<NetListenAddress>) | undefined;
  private readonly onListening: ((addr: NetListenAddress) => void) | undefined;

  private server: Server | undefined;
  private localAddress: NetListenAddress | undefined;
  private readonly sockets: TLSSocket[] = [];
  private readonly inbox: Uint8Array[] = [];
  private readonly socketWaiters: SocketWaiter[] = [];
  private lifecycle: Promise<void> | undefined;
  private writeChain: Promise<void> = Promise.resolve();
  private retainedPeer: NetTransport | undefined;
  private identityBinding: EndpointIdentityVerification | undefined;
  private peerFingerprint: string | undefined;
  private identityFailed = false;
  private closed = false;
  private closing = false;

  constructor(options: NetTransportOptions) {
    assertTlsMaterial(options.tls);
    if (options.pinnedPeerFingerprints.length === 0 && options.provenanceUnavailable !== true) {
      throw new Error(
        "NetTransport requires pinnedPeerFingerprints or explicit provenanceUnavailable",
      );
    }
    this.endpointId = options.endpointId;
    this.tls = options.tls;
    this.listenOpts = options.listen;
    this.connectOpts = options.connect;
    this.pinnedPeerFingerprints = options.pinnedPeerFingerprints;
    this.expectedPeerActorRef = options.expectedPeerActorRef ?? "net-peer";
    this.identityVerifier = options.identityVerifier ?? createMtlsEndpointIdentityVerifier();
    this.eStopGate = options.eStopGate ?? createInternalEStop();
    this.maxFrameBytes = options.maxFrameBytes ?? COMMS_LIMITS.maxFrameBytes;
    this.eventSink = options.eventSink;
    this.provenanceUnavailable = options.provenanceUnavailable === true;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 10_000;
    this.peerConnectProvider = options.peerConnectProvider;
    this.onListening = options.onListening;
  }

  getLocalAddress(): NetListenAddress | undefined {
    return this.localAddress;
  }

  getPeerFingerprint(): string | undefined {
    return this.peerFingerprint;
  }

  getIdentityBinding(): EndpointIdentityVerification | undefined {
    return this.identityBinding;
  }

  isFrozen(): boolean {
    return this.eStopGate.isFrozen();
  }

  /** Keep the paired transport reachable so its connect/listen loop is not GC'd. */
  retainPeer(peer: NetTransport): void {
    this.retainedPeer = peer;
  }

  begin(): Promise<void> {
    this.lifecycle ??= this.runLifecycle();
    return this.lifecycle;
  }

  async ready(): Promise<void> {
    await this.begin();
    if (this.sockets.length > 0) {
      return;
    }
    await this.waitForSocket();
  }

  async listen(): Promise<NetListenAddress> {
    if (this.localAddress !== undefined) {
      return this.localAddress;
    }
    const opts = this.listenOpts ?? { host: "127.0.0.1", port: 0 };
    this.server = createServer(buildServerTlsOptions(this.tls), (socket) => {
      this.bindSecureSocket(socket);
    });
    this.server.on("tlsClientError", (error) => {
      this.failClosed("tls", error.message);
    });
    await this.bindServer(opts);
    const local = this.localAddress;
    if (local === undefined) {
      throw new Error("NetTransport listen did not record an address");
    }
    this.onListening?.(local);
    return local;
  }

  async connect(address?: NetListenAddress): Promise<void> {
    const target = address ?? this.connectOpts ?? (await this.peerConnectProvider?.());
    if (target === undefined) {
      throw new Error("NetTransport.connect requires connect options or a peer address");
    }
    await new Promise<void>((resolve, reject) => {
      const socket = tlsConnect(buildClientTlsOptions(this.tls, target), () => {
        if (this.bindSecureSocket(socket)) {
          resolve();
          return;
        }
        reject(new Error("NetTransport peer identity rejected"));
      });
      socket.once("error", (error: Error) => {
        this.failClosed("tls", error.message);
        reject(error);
      });
    });
  }

  async dispatch(
    envelope: VerifiedEnvelope,
  ): Promise<Result<{ readonly attemptRef: string }, CommsViolation>> {
    const blocked = this.guardMutable("send");
    if (blocked !== undefined) {
      return err(blocked);
    }
    const sealed = assertVerifiedEnvelope(envelope);
    if (!sealed.ok) {
      return sealed;
    }
    const wired = await this.sendEncoded(encodeCommunicationWireFrame(envelope.envelope));
    if (!wired.ok) {
      return wired;
    }
    return ok({ attemptRef: `net-${envelope.envelope.messageId as string}` });
  }

  async receive(): Promise<Result<Uint8Array, CommsViolation>> {
    const blocked = this.guardMutable("receive");
    if (blocked !== undefined) {
      return err(blocked);
    }
    await this.begin();
    const next = this.inbox.shift();
    if (next === undefined) {
      return err(transportFailed("receive", "net inbox empty"));
    }
    return ok(next);
  }

  async handshake(
    request: SessionHandshake,
  ): Promise<Result<{ readonly ackDigest: string }, CommsViolation>> {
    const blocked = this.guardMutable("session");
    if (blocked !== undefined) {
      return err(blocked);
    }
    const body = new TextEncoder().encode(
      JSON.stringify({ transcriptDigest: request.transcriptDigest }),
    );
    const sent = await this.writeFrame(NET_FRAME_TYPE_HANDSHAKE, body);
    if (!sent.ok) {
      return sent;
    }
    return ok({ ackDigest: request.transcriptDigest });
  }

  async sendRawFrame(bytes: Uint8Array): Promise<Result<void, CommsViolation>> {
    const blocked = this.guardMutable("send");
    if (blocked !== undefined) {
      return err(blocked);
    }
    return this.sendEncoded(bytes);
  }

  async close(): Promise<void> {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.closed = true;
    this.rejectWaiters(new Error("NetTransport closed"));
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.length = 0;
    const server = this.server;
    this.server = undefined;
    if (server !== undefined) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    const peer = this.retainedPeer;
    this.retainedPeer = undefined;
    if (peer !== undefined) {
      await peer.close();
    }
  }

  private async runLifecycle(): Promise<void> {
    if (this.listenOpts !== undefined || this.onListening !== undefined) {
      await this.listen();
    }
    if (this.connectOpts !== undefined || this.peerConnectProvider !== undefined) {
      await this.connect();
    }
  }

  private async bindServer(opts: NetListenAddress): Promise<void> {
    const server = this.server;
    if (server === undefined) {
      throw new Error("NetTransport server missing");
    }
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(opts.port, opts.host, () => resolve());
    });
    const addr = server.address();
    if (addr === null || typeof addr === "string") {
      throw new Error("NetTransport listen did not bind a TCP address");
    }
    this.localAddress = { host: addr.address, port: addr.port };
  }

  private bindSecureSocket(socket: TLSSocket): boolean {
    if (this.closed || this.eStopGate.isFrozen()) {
      socket.destroy();
      return false;
    }
    const fingerprint = extractPeerFingerprint(socket);
    if (fingerprint === undefined) {
      this.failClosed("identity", "peer presented no certificate");
      socket.destroy();
      return false;
    }
    const verified = this.identityVerifier.verifyPresentedIdentity({
      expectedActorRef: this.expectedPeerActorRef,
      presentedFingerprint: fingerprint,
      pinnedFingerprints: this.pinnedPeerFingerprints,
      tlsVerified: socket.authorized === true,
      provenanceUnavailable: this.provenanceUnavailable,
    });
    if (!verified.ok) {
      this.failClosed("identity", verified.error.message);
      socket.destroy();
      return false;
    }
    this.peerFingerprint = verified.value.fingerprint;
    this.identityBinding = verified.value;
    this.sockets.push(socket);
    this.attachReader(socket);
    emitNetTransportEvent(this.eventSink, "PeerAuthenticated", {
      endpointId: this.endpointId,
      fingerprint: verified.value.fingerprint,
      provenanceUnavailable: verified.value.provenanceUnavailable,
    });
    this.resolveWaiters();
    return true;
  }

  private attachReader(socket: TLSSocket): void {
    const parseState: NetFrameParseState = { buffer: new Uint8Array() };
    socket.on("data", (chunk: Buffer) => {
      this.onSocketBytes(parseState, Uint8Array.from(chunk));
    });
    socket.on("close", () => {
      const index = this.sockets.indexOf(socket);
      if (index >= 0) {
        this.sockets.splice(index, 1);
      }
    });
  }

  private onSocketBytes(parseState: NetFrameParseState, chunk: Uint8Array): void {
    if (this.eStopGate.isFrozen() || this.closed) {
      return;
    }
    const parsed = pushNetBytes(parseState, chunk, this.maxFrameBytes);
    if (!parsed.ok) {
      this.failClosed("frame", parsed.error.message);
      return;
    }
    for (const frame of parsed.value) {
      if (frame.type === NET_FRAME_TYPE_ENVELOPE) {
        this.inbox.push(frame.payload);
      }
    }
  }

  private async sendEncoded(bytes: Uint8Array): Promise<Result<void, CommsViolation>> {
    return this.writeFrame(NET_FRAME_TYPE_ENVELOPE, bytes);
  }

  private async writeFrame(
    type: typeof NET_FRAME_TYPE_ENVELOPE | typeof NET_FRAME_TYPE_HANDSHAKE,
    payload: Uint8Array,
  ): Promise<Result<void, CommsViolation>> {
    try {
      await this.ready();
    } catch (error) {
      return err(transportFailed("send", error instanceof Error ? error.message : "not ready"));
    }
    const socket = this.sockets[0];
    if (socket === undefined || socket.destroyed) {
      return err(transportFailed("send", "no TLS socket"));
    }
    const frame = encodeNetFrame(type, payload);
    return this.enqueueWrite(socket, frame);
  }

  private enqueueWrite(
    socket: TLSSocket,
    frame: Uint8Array,
  ): Promise<Result<void, CommsViolation>> {
    return new Promise((resolve) => {
      this.writeChain = this.writeChain.then(
        () => this.writeNow(socket, frame, resolve),
        () => this.writeNow(socket, frame, resolve),
      );
    });
  }

  private writeNow(
    socket: TLSSocket,
    frame: Uint8Array,
    resolve: (result: Result<void, CommsViolation>) => void,
  ): Promise<void> {
    return new Promise((done) => {
      socket.write(frame, (error) => {
        if (error !== undefined && error !== null) {
          resolve(err(transportFailed("send", "socket write failed")));
          done();
          return;
        }
        resolve(ok(undefined));
        done();
      });
    });
  }

  private guardMutable(phase: NetMutablePhase): CommsViolation | undefined {
    if (this.closed) {
      return transportFailed(phase, "NetTransport closed");
    }
    if (this.eStopGate.isFrozen()) {
      return frozenViolation(phase);
    }
    return undefined;
  }

  private failClosed(fault: "tls" | "identity" | "frame", message: string): void {
    if (this.identityFailed || this.closed) {
      return;
    }
    this.identityFailed = true;
    this.eStopGate.setFrozen(true);
    emitNetTransportEvent(this.eventSink, "SecurityRejected", {
      endpointId: this.endpointId,
      eStop: true,
      fault,
      reason: message,
    });
    emitNetTransportEvent(this.eventSink, "PeerRejected", {
      endpointId: this.endpointId,
      reason: message,
    });
    this.rejectWaiters(new Error(message));
    for (const socket of this.sockets) {
      socket.destroy();
    }
  }

  private waitForSocket(): Promise<void> {
    if (this.sockets.length > 0) {
      return Promise.resolve();
    }
    if (this.identityFailed || this.closed) {
      return Promise.reject(new Error("NetTransport identity failed or closed"));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("NetTransport ready timed out"));
      }, this.readyTimeoutMs);
      this.socketWaiters.push({
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  private resolveWaiters(): void {
    const waiters = this.socketWaiters.splice(0, this.socketWaiters.length);
    for (const waiter of waiters) {
      waiter.resolve();
    }
  }

  private rejectWaiters(error: Error): void {
    const waiters = this.socketWaiters.splice(0, this.socketWaiters.length);
    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }
}

export interface NetTransportPairOptions {
  readonly material?: IssuedMtlsPair;
  readonly eStopGate?: EStopGate;
  readonly eventSink?: NetTransportEventSink;
  readonly maxFrameBytes?: number;
  readonly readyTimeoutMs?: number;
  readonly provenanceUnavailable?: boolean;
  readonly pinnedOverrideA?: readonly string[];
  readonly pinnedOverrideB?: readonly string[];
}

function pairTls(identity: IssuedMtlsPair["a"], caPem: string): NetTransportTlsMaterial {
  return { cert: identity.cert, key: identity.key, ca: caPem };
}

/**
 * In-process pair: side A listens on 127.0.0.1, side B connects. Both sides
 * present leaf certificates issued by the same CA and pin each other's
 * fingerprint. The returned transports start their lifecycle immediately;
 * call {@link connectNetTransportPair} when the caller needs them ready.
 */
export function createNetTransportPair(
  options: NetTransportPairOptions = {},
): [NetTransport, NetTransport] {
  const issued = options.material ?? issueSelfSignedMtlsPair();
  const exchange = new PortExchange();
  const shared = {
    ...(options.eStopGate !== undefined ? { eStopGate: options.eStopGate } : {}),
    ...(options.eventSink !== undefined ? { eventSink: options.eventSink } : {}),
    ...(options.maxFrameBytes !== undefined ? { maxFrameBytes: options.maxFrameBytes } : {}),
    ...(options.readyTimeoutMs !== undefined ? { readyTimeoutMs: options.readyTimeoutMs } : {}),
    ...(options.provenanceUnavailable === true ? { provenanceUnavailable: true } : {}),
  };
  const a = new NetTransport({
    endpointId: "net-side-a",
    tls: pairTls(issued.a, issued.ca.cert),
    listen: { host: "127.0.0.1", port: 0 },
    pinnedPeerFingerprints: options.pinnedOverrideA ?? [issued.b.fingerprint],
    expectedPeerActorRef: issued.b.actorRef,
    onListening: (addr) => exchange.publish("a", addr),
    ...shared,
  });
  const b = new NetTransport({
    endpointId: "net-side-b",
    tls: pairTls(issued.b, issued.ca.cert),
    pinnedPeerFingerprints: options.pinnedOverrideB ?? [issued.a.fingerprint],
    expectedPeerActorRef: issued.a.actorRef,
    peerConnectProvider: () => exchange.wait("a"),
    ...shared,
  });
  a.retainPeer(b);
  b.retainPeer(a);
  a.begin().catch(() => undefined);
  b.begin().catch(() => undefined);
  return [a, b];
}

export async function connectNetTransportPair(
  options: NetTransportPairOptions = {},
): Promise<[NetTransport, NetTransport]> {
  const pair = createNetTransportPair(options);
  await Promise.all([pair[0].ready(), pair[1].ready()]);
  return pair;
}
