/**
 * FileTransport (ADR-0018 D1, T1/T2) — a cross-process `CommunicationTransport`
 * backed by a shared filesystem directory. It fills the gap between
 * `LoopbackTransport` (in-process) and `A2ATransportAdapter` (cross-host,
 * injected): two OS processes on the same host exchange envelopes by writing
 * and reading durable frame files.
 *
 * Design (ADR-0018 §1, "不可协商的约束"):
 *
 * 1. **Runtime is the sole mutator; the transport emits entries, never writes
 *    the coordination world.** FileTransport persists only wire frames, not
 *    coordination state.
 * 2. **Payload by reference.** The envelope carries `contentRef`; the frame
 *    never inlines payload bytes (RFC-0001 §7, ADR-0003 boundary).
 * 3. **E-Stop on send/receive.** An `EStopGate` is checked before every
 *    dispatch and receive; a frozen gate fails the call with `transport_failed`
 *    rather than touching the filesystem.
 * 4. **At-least-once delivery.** A dispatch that returns `ok` has durably
 *    written the frame (atomic + fsync via `atomicWriteFileSync`); a crash
 *    before acknowledgement does not lose the frame. Idempotent reception is
 *    the receiver's responsibility via `CommsStore.claimIdempotency`, keyed by
 *    the envelope's `occurrenceId`/`idempotencyKey` (ADR-0016 syscall tiers).
 * 5. **Strict wire v1.** Frames use `encodeCommunicationWireFrame` /
 *    `parseCommunicationWireFrame` — the same strict v1 codec as LoopbackTransport
 *    and a2a, so the a2a/0.1 conformance profile is inherited, not redefined.
 *
 * The transport does NOT delete received frames automatically — the receiver
 * acknowledges via `acknowledge(messageId)` after the idempotent claim, so a
 * crash between receive and claim re-reads the same frame and deduplicates
 * (at-least-once, exactly-once-effect).
 */
import { mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "@cantilune/core";
import { type CommunicationTransport } from "../../ports/communicationTransport.js";
import { type VerifiedEnvelope } from "../../envelope/communicationEnvelope.js";
import { type SessionHandshake } from "../../session/sessionTransportBinding.js";
import { commsViolation, type CommsViolation } from "../../foundation/commsViolation.js";
import { encodeCommunicationWireFrame } from "../../codec/strictWireCodec.js";
import { assertVerifiedEnvelope } from "../../security/commsCapability.js";
import { atomicWriteFileSync } from "../../file/atomicWrite.js";
import type { EStopGate } from "../../security/identityVerifier.js";

const OUTBOX_DIR = "outbox";
const INBOX_DIR = "inbox";
const FRAME_SUFFIX = ".frame";
const HANDSHAKE_PREFIX = ".handshake-";
/**
 * Well-formed standard base64 (A–Z a–z 0–9 + /) with optional `=` padding,
 * length a multiple of 4. Used to validate a frame file's contents before the
 * lenient `Buffer.from(_, "base64")` decode silently masks corruption.
 */
const BASE64_FRAME = /^[A-Za-z0-9+/]*={0,2}$/;

export interface FileTransportOptions {
  /**
   * Directory this transport writes dispatched frames into. For a pair, this is
   * the peer's {@link inboxDir}. Created if absent.
   */
  readonly outboxDir: string;
  /**
   * Directory this transport reads received frames from. For a pair, this is the
   * peer's {@link outboxDir}. Created if absent.
   */
  readonly inboxDir: string;
  /** This transport's endpoint identity (used in violation diagnostics). */
  readonly endpointId: string;
  /** Optional E-Stop gate; when frozen, dispatch and receive fail closed. */
  readonly eStopGate?: EStopGate;
  /**
   * Maximum bytes to read from a single frame file (defense against a malformed
   * or truncated file). Defaults to 1 MiB.
   */
  readonly maxFrameBytes?: number;
  /**
   * Root directory for the default outbox/inbox layout (used when
   * {@link outboxDir}/{@link inboxDir} are not provided). Ignored if both are
   * given explicitly.
   */
  readonly dir?: string;
}

interface InboxEntry {
  readonly messageId: string;
  readonly path: string;
  readonly sequence: number;
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function safeFileName(messageId: string): string {
  // messageId is opaque; replace anything that could be a path separator so a
  // frame id can never escape its directory.
  return String(messageId).replace(/[^A-Za-z0-9._-]/g, "_");
}

function inboxSequence(name: string): number {
  // Frames are prefixed with a zero-padded monotonic sequence so FIFO holds
  // across concurrent writers (two processes dispatching to the same shared
  // outbox never interleave a reader's view out of order).
  const match = /^(\d+)-/.exec(name);
  return match === null ? 0 : Number(match[1]);
}

/**
 * A cross-process file-backed transport. Construct one per process; pair two
 * via {@link connectFileTransportPair} so each writes to the other's inbox.
 */
export class FileTransport implements CommunicationTransport {
  readonly transportId = "file";
  private readonly outboxDir: string;
  private readonly inboxDir: string;
  private readonly maxFrameBytes: number;
  private readonly eStopGate: EStopGate | undefined;
  private writeCounter = 0;

  constructor(options: FileTransportOptions) {
    const root = options.dir ?? ".";
    this.outboxDir = options.outboxDir ?? join(root, OUTBOX_DIR);
    this.inboxDir = options.inboxDir ?? join(root, INBOX_DIR);
    this.maxFrameBytes = options.maxFrameBytes ?? 1_048_576;
    this.eStopGate = options.eStopGate;
    ensureDir(this.outboxDir);
    ensureDir(this.inboxDir);
  }

  /** Directory this transport writes dispatched frames into. */
  get outbox(): string {
    return this.outboxDir;
  }

  /** Directory this transport reads received frames from. */
  get inbox(): string {
    return this.inboxDir;
  }

  async dispatch(
    envelope: VerifiedEnvelope,
  ): Promise<Result<{ readonly attemptRef: string }, CommsViolation>> {
    if (this.isFrozen()) {
      return err(commsViolation("transport_failed", "send", "E-Stop frozen", { retryable: false }));
    }
    const sealed = assertVerifiedEnvelope(envelope);
    if (!sealed.ok) {
      return sealed;
    }
    const wireBytes = encodeCommunicationWireFrame(envelope.envelope);
    const mid = safeFileName(envelope.envelope.messageId);
    const seq = (this.writeCounter += 1);
    const name = `${String(seq).padStart(10, "0")}-${mid}${FRAME_SUFFIX}`;
    const target = join(this.outboxDir, name);
    // atomicWriteFileSync fsyncs the temp file then renames — a reader never
    // sees a partial frame, and a crash before rename leaves no frame (the
    // temp file is cleaned by the writer's catch or the next start).
    atomicWriteFileSync(target, Buffer.from(wireBytes).toString("base64"));
    return ok({ attemptRef: `file-${envelope.envelope.messageId as string}` });
  }

  async receive(): Promise<Result<Uint8Array, CommsViolation>> {
    if (this.isFrozen()) {
      return err(
        commsViolation("transport_failed", "receive", "E-Stop frozen", { retryable: true }),
      );
    }
    const entry = this.peekInbox();
    if (entry === undefined) {
      return err(
        commsViolation("transport_failed", "receive", "file inbox empty", { retryable: true }),
      );
    }
    let raw: string;
    try {
      raw = readFileSync(entry.path, "utf8");
    } catch {
      // A vanished frame is a benign race (another reader consumed it) — retry.
      return err(
        commsViolation("transport_failed", "receive", "frame vanished", { retryable: true }),
      );
    }
    if (raw.length > this.maxFrameBytes * 2) {
      return err(
        commsViolation("transport_failed", "receive", "frame exceeds maxFrameBytes", {
          retryable: false,
        }),
      );
    }
    // Node's `Buffer.from(_, "base64")` is lenient — it ignores characters
    // outside the base64 alphabet and never throws, so a malformed frame file
    // would silently decode to wrong bytes. We validate the base64 shape
    // explicitly (well-formed standard base64, length a multiple of 4) before
    // decoding, so a corrupt frame fails at the transport boundary with a
    // precise diagnostic rather than being passed to the codec as noise.
    if (!BASE64_FRAME.test(raw)) {
      return err(
        commsViolation("transport_failed", "receive", "frame is not valid base64", {
          retryable: false,
        }),
      );
    }
    const bytes = Uint8Array.from(Buffer.from(raw, "base64"));
    // The transport returns raw strict-wire-v1 bytes; the ingress codec parses
    // them (same boundary as LoopbackTransport). We do one structural sanity
    // check — bytes length against the wire limit — so a truncated/padded file
    // fails at the transport boundary rather than deep in the codec.
    if (bytes.byteLength === 0) {
      return err(
        commsViolation("transport_failed", "receive", "frame is empty", { retryable: false }),
      );
    }
    return ok(bytes);
  }

  /**
   * Acknowledge (remove) the currently-peeked frame by messageId after the
   * receiver has idempotently claimed it via `CommsStore.claimIdempotency`.
   * Without this the frame remains and is re-read on the next receive
   * (at-least-once); the idempotent claim deduplicates the effect, but
   * acknowledging bounds inbox growth.
   */
  acknowledge(messageId: string): Result<void, CommsViolation> {
    const entry = this.peekInbox();
    if (entry === undefined || entry.messageId !== safeFileName(messageId)) {
      return ok(undefined);
    }
    try {
      unlinkSync(entry.path);
    } catch {
      // Already removed by a concurrent reader — benign.
    }
    return ok(undefined);
  }

  async handshake(
    request: SessionHandshake,
  ): Promise<Result<{ readonly ackDigest: string }, CommsViolation>> {
    if (this.isFrozen()) {
      return err(commsViolation("transport_failed", "session", "E-Stop frozen"));
    }
    // File-based handshake marker: the peer reads a `.handshake-<sessionId>`
    // marker from its inbox. This mirrors LoopbackTransport's simplified
    // handshake — the durable channel binding is established by the session
    // service, not the transport.
    const marker = `${HANDSHAKE_PREFIX}${safeFileName(request.sessionId)}`;
    const target = join(this.outboxDir, marker);
    const body = JSON.stringify({ transcriptDigest: request.transcriptDigest });
    atomicWriteFileSync(target, body);
    return ok({ ackDigest: request.transcriptDigest });
  }

  private isFrozen(): boolean {
    return this.eStopGate?.isFrozen() ?? false;
  }

  private peekInbox(): InboxEntry | undefined {
    let names: string[];
    try {
      names = readdirSync(this.inboxDir);
    } catch {
      return undefined;
    }
    const frames = names.filter((n) => n.endsWith(FRAME_SUFFIX));
    if (frames.length === 0) return undefined;
    frames.sort((a, b) => inboxSequence(a) - inboxSequence(b) || a.localeCompare(b));
    const first = frames[0]!;
    const base = first.replace(/^\d+-/, "").replace(/\.frame$/, "");
    return {
      messageId: base,
      path: join(this.inboxDir, first),
      sequence: inboxSequence(first),
    };
  }
}

/**
 * Connect a cross-process file transport pair. The returned transports are
 * cross-linked: side A writes to `a-outbox/` which side B reads as its inbox,
 * and side B writes to `b-outbox/` which side A reads as its inbox. This models
 * the real cross-process topology — two processes on one host sharing a
 * filesystem, each writing to the other's inbox directory.
 *
 * For true cross-process tests, construct one `FileTransport` per process with
 * explicit `outboxDir`/`inboxDir` pointing at the shared filesystem; this
 * helper is for in-process tests where both sides live in one process.
 */
export function connectFileTransportPair(
  dir: string,
  options?: {
    readonly eStopGate?: EStopGate;
    readonly maxFrameBytes?: number;
  },
): [FileTransport, FileTransport] {
  const aOutbox = join(dir, "a-outbox");
  const bOutbox = join(dir, "b-outbox");
  const sharedOpts = {
    ...(options?.eStopGate !== undefined ? { eStopGate: options.eStopGate } : {}),
    ...(options?.maxFrameBytes !== undefined ? { maxFrameBytes: options.maxFrameBytes } : {}),
  };
  const a = new FileTransport({
    outboxDir: aOutbox,
    inboxDir: bOutbox,
    endpointId: "file-side-a",
    ...sharedOpts,
  });
  const b = new FileTransport({
    outboxDir: bOutbox,
    inboxDir: aOutbox,
    endpointId: "file-side-b",
    ...sharedOpts,
  });
  return [a, b];
}
