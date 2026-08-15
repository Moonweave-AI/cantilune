import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import {
  type IdentityVerifier,
  type ReplayProtector,
  type EStopGate,
  type CommsAuthorizer,
} from "../security/identityVerifier.js";
import { type MessageConsumer, type TransportContext } from "../ports/communicationTransport.js";
import { parseCommunicationWireFrame, digestCommunicationFrame } from "../codec/strictWireCodec.js";
import { type EventSink } from "../ports/runtimePorts.js";
import { commsEventId, deliveryAttemptId } from "../foundation/messageId.js";
import { type PeerDescriptor } from "../peer/peerDescriptor.js";
import {
  sealAuthenticatedCommsContext,
  sealVerifiedEnvelope,
} from "../security/commsCapability.js";
import { type AuthenticatedPeerContext } from "../peer/authenticatedPeerContext.js";
import { COMMS_LIMITS } from "../foundation/commsLimits.js";

/** Transport binding required for inbound trust boundary. */
export interface IngressTransportContext extends TransportContext {
  readonly peerDescriptor: PeerDescriptor;
  readonly credentialRef: string;
  readonly channelBindingMaterial: string;
}

export interface CommsIngressDeps {
  readonly store: CommsStore;
  readonly identity: IdentityVerifier;
  readonly authorizer: CommsAuthorizer;
  readonly replay: ReplayProtector;
  readonly eStop: EStopGate;
  readonly events: EventSink;
  readonly clock: { now(): string };
  readonly runtimeConsumer?: MessageConsumer;
}

function isIngressContext(context: TransportContext): context is IngressTransportContext {
  return (
    "peerDescriptor" in context &&
    "credentialRef" in context &&
    "channelBindingMaterial" in context &&
    context.peerDescriptor !== undefined &&
    typeof context.credentialRef === "string" &&
    typeof context.channelBindingMaterial === "string"
  );
}

function checkEnvelopeExpired(
  envelope: { readonly expiresAt: string },
  clock: { now(): string },
): CommsViolation | undefined {
  const now = Date.parse(clock.now());
  const expires = Date.parse(envelope.expiresAt);
  if (!Number.isNaN(now) && !Number.isNaN(expires) && now >= expires) {
    return commsViolation("wire_expired", "ingress", "envelope expired");
  }
  return undefined;
}

async function verifyInboundIdentity(
  deps: CommsIngressDeps,
  context: IngressTransportContext,
): Promise<Result<AuthenticatedPeerContext, CommsViolation>> {
  return deps.identity.verifyPeer({
    descriptor: context.peerDescriptor,
    credentialRef: context.credentialRef,
    channelBindingMaterial: context.channelBindingMaterial,
  });
}

function verifySenderMatchesPrincipal(
  envelope: { readonly sender: { readonly actorId: unknown } },
  principal: { readonly actorId: unknown },
): CommsViolation | undefined {
  if (envelope.sender.actorId !== principal.actorId) {
    return commsViolation(
      "identity_unverified",
      "ingress",
      "wire sender does not match authenticated principal",
    );
  }
  return undefined;
}

/**
 * Inbound pipeline (fail-closed):
 * strict decode → transport binding → identity → expiry → replay → authorization
 * → durable inbox → runtime consumer → authenticated ack event.
 */
export class CommsIngress {
  constructor(private readonly deps: CommsIngressDeps) {}

  private validateInboundContext(
    bytes: unknown,
    context: TransportContext,
  ): Result<{ rawBytes: Uint8Array; ingressContext: IngressTransportContext }, CommsViolation> {
    if (!(bytes instanceof Uint8Array)) {
      return err(commsViolation("codec_invalid", "ingress", "expected Uint8Array frame"));
    }
    if (!isIngressContext(context)) {
      return err(
        commsViolation("identity_unverified", "ingress", "transport binding context required"),
      );
    }
    if (context.tlsVerified === false) {
      return err(commsViolation("identity_unverified", "ingress", "TLS not verified"));
    }
    return ok({ rawBytes: bytes, ingressContext: context });
  }

  async acceptInboundFrame(
    bytes: unknown,
    context: TransportContext,
  ): Promise<
    Result<
      {
        readonly frameDigest: string;
        readonly messageId: string;
        readonly inboxResult: "committed" | "idempotent_replay";
      },
      CommsViolation
    >
  > {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "ingress", "comms E-Stop active"));
    }
    const validated = this.validateInboundContext(bytes, context);
    if (!validated.ok) return validated;
    const { rawBytes, ingressContext } = validated.value;

    const decoded = parseCommunicationWireFrame(rawBytes);
    if (!decoded.ok) {
      this.emitSecurityRejected(decoded.error.code);
      return decoded;
    }
    const envelope = decoded.value;

    const identity = await verifyInboundIdentity(this.deps, ingressContext);
    if (!identity.ok) {
      this.emitSecurityRejected(identity.error.code);
      return identity;
    }

    const expired = checkEnvelopeExpired(envelope, this.deps.clock);
    if (expired !== undefined) {
      this.emitSecurityRejected(expired.code);
      return err(expired);
    }

    const digest = digestCommunicationFrame(envelope);
    const replayCheck = this.deps.replay.checkReplay({
      messageDigest: digest,
      issuedAt: envelope.issuedAt,
      senderInstanceId: identity.value.runtimeInstanceId as string,
    });
    if (!replayCheck.ok) {
      this.emitSecurityRejected(replayCheck.error.code);
      return replayCheck;
    }

    const authContext = sealAuthenticatedCommsContext({
      peer: identity.value,
      roles: ["session-member"],
    });
    const authorized = this.deps.authorizer.authorize({
      action: "ingress.receive",
      context: authContext,
      resource: envelope.metadata.sessionId as string,
    });
    if (!authorized.ok) {
      this.emitSecurityRejected(authorized.error.code);
      return authorized;
    }

    const senderMismatch = verifySenderMatchesPrincipal(envelope, identity.value.principal);
    if (senderMismatch !== undefined) {
      this.emitSecurityRejected(senderMismatch.code);
      return err(senderMismatch);
    }

    this.deps.replay.recordSeen(digest, envelope.expiresAt);

    const delivery = {
      deliveryId: deliveryAttemptId(`in-${envelope.messageId as string}`),
      envelopeRef: envelope.messageId as string,
      envelopeDigest: envelope.integrityDigest,
      state: "received" as const,
      attempt: 0,
      createdAt: this.deps.clock.now(),
    };
    const event = {
      eventId: commsEventId(`evt-in-${envelope.messageId as string}`),
      storeSequence: this.deps.store.nextSequence(),
      kind: "MessageReceived" as const,
      occurredAt: this.deps.clock.now(),
      correlationId: envelope.metadata.correlationId as string,
      occurrenceId: envelope.metadata.occurrenceId as string,
      payload: { messageId: envelope.messageId as string },
    };

    const inboxResult = this.deps.store.appendInbox({
      envelope,
      delivery,
      event,
      idempotencyKey: envelope.metadata.idempotencyKey ?? envelope.metadata.correlationId,
    });
    if (inboxResult === "conflict") {
      return err(commsViolation("invalid_input", "ingress", "inbox idempotency conflict"));
    }

    if (inboxResult === "committed") {
      const consumed = await this.deps.runtimeConsumer?.consume(envelope);
      if (consumed !== undefined && !consumed.ok) {
        return consumed;
      }
    }

    const ackEvent = {
      eventId: commsEventId(`evt-ack-${envelope.messageId as string}`),
      storeSequence: this.deps.store.nextSequence(),
      kind: "MessageAcknowledged" as const,
      occurredAt: this.deps.clock.now(),
      correlationId: envelope.metadata.correlationId as string,
      occurrenceId: envelope.metadata.occurrenceId as string,
      payload: {
        messageId: envelope.messageId as string,
        digest,
        principal: identity.value.principal.actorId as string,
      },
    };
    this.deps.events.emit(ackEvent);

    sealVerifiedEnvelope({ envelope, verifiedAt: this.deps.clock.now() });

    if (this.deps.store.snapshot().inbox.length > COMMS_LIMITS.maxInboxBacklog) {
      return err(
        commsViolation("backpressure", "ingress", "inbox backlog exceeded", { retryable: true }),
      );
    }

    return ok({
      frameDigest: digest,
      messageId: envelope.messageId as string,
      inboxResult,
    });
  }

  private emitSecurityRejected(reason: string): void {
    this.deps.events.emit({
      eventId: commsEventId(`evt-sec-${Date.now()}`),
      storeSequence: this.deps.store.nextSequence(),
      kind: "SecurityRejected",
      occurredAt: this.deps.clock.now(),
      payload: { reason },
    });
  }
}
