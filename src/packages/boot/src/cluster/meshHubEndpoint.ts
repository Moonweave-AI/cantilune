/**
 * MeshHubEndpoint — agent-facing N-to-N transport.
 *
 * dispatch routes by envelope recipient ActorRef; receive drains the local inbox.
 */
import { type Result, err, ok, type ActorId } from "@cantilune/core";
import type { CommunicationTransport } from "@cantilune/comms/ports";
import {
  type VerifiedEnvelope,
  type SessionHandshake,
  encodeCommunicationWireFrame,
  assertVerifiedEnvelope,
  commsViolation,
  type CommsViolation,
} from "@cantilune/comms";

export interface MeshHubLookup {
  lookup(recipient: string): MeshHubEndpoint | undefined;
}

export class MeshHubEndpoint implements CommunicationTransport {
  readonly transportId = "mesh-hub";
  private readonly inbox: Uint8Array[] = [];
  private closed = false;

  constructor(
    readonly agentId: ActorId,
    private readonly hub: MeshHubLookup,
  ) {}

  deliver(bytes: Uint8Array): void {
    if (this.closed) return;
    this.inbox.push(bytes);
  }

  async dispatch(
    envelope: VerifiedEnvelope,
  ): Promise<Result<{ readonly attemptRef: string }, CommsViolation>> {
    if (this.closed) {
      return err(
        commsViolation("transport_failed", "send", "mesh endpoint closed", { retryable: false }),
      );
    }
    const sealed = assertVerifiedEnvelope(envelope);
    if (!sealed.ok) {
      return sealed;
    }
    const recipient = envelope.envelope.recipient.actorId as string;
    const target = this.hub.lookup(recipient);
    if (target === undefined) {
      return err(
        commsViolation("transport_failed", "send", `unknown mesh recipient ${recipient}`, {
          retryable: false,
        }),
      );
    }
    const bytes = encodeCommunicationWireFrame(envelope.envelope);
    target.deliver(bytes);
    return ok({ attemptRef: `attempt-${envelope.envelope.messageId as string}` });
  }

  async receive(): Promise<Result<Uint8Array, CommsViolation>> {
    if (this.closed) {
      return err(
        commsViolation("transport_failed", "receive", "mesh endpoint closed", {
          retryable: true,
        }),
      );
    }
    const next = this.inbox.shift();
    if (next === undefined) {
      return err(
        commsViolation("transport_failed", "receive", "mesh inbox empty", { retryable: true }),
      );
    }
    return ok(next);
  }

  async handshake(
    request: SessionHandshake,
  ): Promise<Result<{ readonly ackDigest: string }, CommsViolation>> {
    if (this.closed) {
      return err(commsViolation("transport_failed", "session", "mesh endpoint closed"));
    }
    return ok({ ackDigest: request.transcriptDigest });
  }

  close(): void {
    this.closed = true;
    this.inbox.length = 0;
  }
}
