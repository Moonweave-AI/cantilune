import { type Result, err, ok } from "@cantilune/core";
import { type CommunicationTransport } from "../ports/communicationTransport.js";
import { type VerifiedEnvelope } from "../envelope/communicationEnvelope.js";
import { type SessionHandshake } from "../session/sessionTransportBinding.js";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { encodeCommunicationWireFrame } from "../codec/strictWireCodec.js";
import { assertVerifiedEnvelope } from "../security/commsCapability.js";

interface LoopbackEntry {
  readonly bytes: Uint8Array;
  readonly handshake?: SessionHandshake;
}

/** In-process transport for L4/L6 tests — at-least-once with explicit queue. */
export class LoopbackTransport implements CommunicationTransport {
  readonly transportId = "loopback";
  private readonly inbox: LoopbackEntry[] = [];
  private readonly outbox: LoopbackEntry[] = [];

  static connectPair(): [LoopbackTransport, LoopbackTransport] {
    const a = new LoopbackTransport();
    const b = new LoopbackTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  private peer?: LoopbackTransport;

  async dispatch(
    envelope: VerifiedEnvelope,
  ): Promise<Result<{ readonly attemptRef: string }, CommsViolation>> {
    const sealed = assertVerifiedEnvelope(envelope);
    if (!sealed.ok) {
      return sealed;
    }
    if (this.peer === undefined) {
      return err(commsViolation("transport_failed", "send", "loopback peer not connected"));
    }
    const bytes = encodeCommunicationWireFrame(envelope.envelope);
    this.outbox.push({ bytes });
    this.peer.inbox.push({ bytes });
    return ok({ attemptRef: `attempt-${envelope.envelope.messageId as string}` });
  }

  async receive(): Promise<Result<Uint8Array, CommsViolation>> {
    const next = this.inbox.shift();
    if (next === undefined) {
      return err(
        commsViolation("transport_failed", "receive", "loopback inbox empty", { retryable: true }),
      );
    }
    return ok(next.bytes);
  }

  async handshake(
    request: SessionHandshake,
  ): Promise<Result<{ readonly ackDigest: string }, CommsViolation>> {
    if (this.peer === undefined) {
      return err(commsViolation("transport_failed", "session", "loopback peer not connected"));
    }
    this.peer.inbox.push({ bytes: new Uint8Array(), handshake: request });
    return ok({ ackDigest: request.transcriptDigest });
  }
}
