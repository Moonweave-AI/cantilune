import {
  type Result,
  err,
  ok,
  type IdempotencyKey,
  type SchemaEpochBinding,
} from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import { type CommunicationTransport } from "../ports/communicationTransport.js";
import { type SessionAuthority, type EventSink } from "../ports/runtimePorts.js";
import { type CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
import { type AuthenticatedCommsContext } from "../peer/authenticatedPeerContext.js";
import { type EStopGate } from "../security/identityVerifier.js";
import type { MessagingSagaCoordinator } from "../recovery/messagingSagaCoordinator.js";
import { deliveryAttemptId, commsEventId } from "../foundation/messageId.js";
import { COMMS_LIMITS } from "../foundation/commsLimits.js";
import {
  assertAuthenticatedCommsContext,
  sealVerifiedEnvelope,
} from "../security/commsCapability.js";
import { validateOutboundEnvelope } from "../security/envelopePolicy.js";

export interface CommsMessagingServiceDeps {
  readonly store: CommsStore;
  readonly transport: CommunicationTransport;
  readonly sessionAuthority: SessionAuthority;
  readonly bindingResolver?: {
    getActiveBinding(domainId: string): SchemaEpochBinding | undefined;
  };
  readonly eStop: EStopGate;
  readonly events: EventSink;
  readonly clock: { now(): string };
  readonly saga?: MessagingSagaCoordinator;
}

export class CommsMessagingService {
  constructor(private readonly deps: CommsMessagingServiceDeps) {}

  async send(
    context: AuthenticatedCommsContext,
    envelope: CommunicationEnvelope,
    idempotencyKey: IdempotencyKey,
  ): Promise<
    Result<
      {
        readonly deliveryId: string;
        readonly sagaPhase?: string;
        readonly runtimeReceiptRef?: string;
      },
      CommsViolation
    >
  > {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "send", "comms E-Stop active"));
    }
    const sealed = assertAuthenticatedCommsContext(context);
    if (!sealed.ok) {
      return sealed;
    }
    const policy = validateOutboundEnvelope({
      context,
      envelope,
      sessionAuthority: this.deps.sessionAuthority,
      bindingResolver: this.deps.bindingResolver ?? { getActiveBinding: () => undefined },
      store: this.deps.store,
      clock: this.deps.clock,
    });
    if (!policy.ok) {
      return policy;
    }

    if (this.deps.saga !== undefined) {
      const sagaResult = await this.deps.saga.executeSend({ context, envelope, idempotencyKey });
      if (!sagaResult.ok) {
        return sagaResult;
      }
      return ok({
        deliveryId: deliveryAttemptId(`del-${envelope.messageId as string}`) as string,
        sagaPhase: sagaResult.value.phase,
        ...(sagaResult.value.runtimeReceiptRef !== undefined
          ? { runtimeReceiptRef: sagaResult.value.runtimeReceiptRef }
          : {}),
      });
    }

    if (this.deps.store.snapshot().outbox.length >= COMMS_LIMITS.maxInboxBacklog) {
      this.deps.events.emit({
        eventId: commsEventId(`evt-bp-${envelope.messageId as string}`),
        storeSequence: this.deps.store.nextSequence(),
        kind: "BackpressureApplied",
        occurredAt: this.deps.clock.now(),
        payload: { messageId: envelope.messageId as string },
      });
      return err(
        commsViolation("backpressure", "send", "outbox backlog exceeded", { retryable: true }),
      );
    }

    const delivery = {
      deliveryId: deliveryAttemptId(`del-${envelope.messageId as string}`),
      envelopeRef: envelope.messageId as string,
      envelopeDigest: envelope.integrityDigest,
      state: "queued" as const,
      attempt: 0,
      createdAt: this.deps.clock.now(),
    };

    const event = {
      eventId: commsEventId(`evt-enq-${envelope.messageId as string}`),
      storeSequence: this.deps.store.nextSequence(),
      kind: "MessageEnqueued" as const,
      occurredAt: this.deps.clock.now(),
      correlationId: envelope.metadata.correlationId as string,
      occurrenceId: envelope.metadata.occurrenceId as string,
      payload: { messageId: envelope.messageId as string },
    };

    const persisted = this.deps.store.appendOutbox({ envelope, idempotencyKey, delivery, event });
    if (persisted === "conflict") {
      return err(commsViolation("invalid_input", "send", "idempotency conflict"));
    }
    if (persisted === "idempotent_replay") {
      return ok({ deliveryId: delivery.deliveryId as string });
    }

    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: this.deps.clock.now() });
    const dispatched = await this.deps.transport.dispatch(verified);
    if (!dispatched.ok) {
      return dispatched;
    }

    this.deps.events.emit(event);
    return ok({ deliveryId: delivery.deliveryId as string });
  }
}
