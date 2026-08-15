import { type Result, err, ok, type IdempotencyKey } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import {
  type RuntimeObservationPort,
  type RuntimeCommitPort,
  type EventSink,
  type Clock,
} from "../ports/runtimePorts.js";
import { type CommunicationTransport } from "../ports/communicationTransport.js";
import { type AuthenticatedCommsContext } from "../peer/authenticatedPeerContext.js";
import { type CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
import { type EStopGate } from "../security/identityVerifier.js";
import { sealVerifiedEnvelope } from "../security/commsCapability.js";
import { deliveryAttemptId, commsEventId } from "../foundation/messageId.js";

export type MessagingSagaPhase =
  "persisted" | "observed" | "committed" | "dispatched" | "acknowledged" | "failed";

export interface MessagingSagaRecord {
  readonly messageId: string;
  readonly phase: MessagingSagaPhase;
  readonly runtimeSnapshotRef?: string;
  readonly runtimeReceiptRef?: string;
  readonly attemptRef?: string;
  readonly updatedAt: string;
}

export interface MessagingSagaCoordinatorDeps {
  readonly store: CommsStore;
  readonly transport: CommunicationTransport;
  readonly observation: RuntimeObservationPort;
  readonly runtimeCommit: RuntimeCommitPort;
  readonly events: EventSink;
  readonly eStop: EStopGate;
  readonly clock: Clock;
}

/**
 * Durable messaging saga:
 * persist outbox → runtime observe → runtime commit receipt → transport dispatch → ack eligibility.
 */
export class MessagingSagaCoordinator {
  private readonly records = new Map<string, MessagingSagaRecord>();

  constructor(private readonly deps: MessagingSagaCoordinatorDeps) {}

  async executeSend(input: {
    readonly context: AuthenticatedCommsContext;
    readonly envelope: CommunicationEnvelope;
    readonly idempotencyKey: IdempotencyKey;
  }): Promise<Result<MessagingSagaRecord, CommsViolation>> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "send", "comms E-Stop active"));
    }

    const delivery = {
      deliveryId: deliveryAttemptId(`del-${input.envelope.messageId as string}`),
      envelopeRef: input.envelope.messageId as string,
      envelopeDigest: input.envelope.integrityDigest,
      state: "queued" as const,
      attempt: 0,
      createdAt: this.deps.clock.now(),
    };

    const enqueuedEvent = {
      eventId: commsEventId(`evt-enq-${input.envelope.messageId as string}`),
      storeSequence: this.deps.store.nextSequence(),
      kind: "MessageEnqueued" as const,
      occurredAt: this.deps.clock.now(),
      correlationId: input.envelope.metadata.correlationId as string,
      occurrenceId: input.envelope.metadata.occurrenceId as string,
      payload: { messageId: input.envelope.messageId as string },
    };

    const persisted = this.deps.store.appendOutbox({
      envelope: input.envelope,
      idempotencyKey: input.idempotencyKey,
      delivery,
      event: enqueuedEvent,
    });
    if (persisted === "conflict") {
      return err(commsViolation("invalid_input", "send", "idempotency conflict"));
    }
    if (persisted === "idempotent_replay") {
      const existing = this.records.get(input.envelope.messageId as string);
      if (existing !== undefined) {
        return ok(existing);
      }
      const storedDelivery = this.deps.store.getDelivery(input.envelope.messageId);
      return ok({
        messageId: input.envelope.messageId as string,
        phase: storedDelivery?.state === "dispatched" ? "dispatched" : "persisted",
        updatedAt: this.deps.clock.now(),
      });
    }

    let record: MessagingSagaRecord = {
      messageId: input.envelope.messageId as string,
      phase: "persisted",
      updatedAt: this.deps.clock.now(),
    };
    this.records.set(record.messageId, record);

    const observed = await this.deps.observation.observe({
      source: input.envelope.sender,
      payloadRef: input.envelope.payload.contentRef,
      principal: input.context.peer.principal,
    });
    if (!observed.ok) {
      record = { ...record, phase: "failed", updatedAt: this.deps.clock.now() };
      this.records.set(record.messageId, record);
      return observed;
    }

    record = {
      ...record,
      phase: "observed",
      runtimeSnapshotRef: observed.value.snapshotRef as string,
      updatedAt: this.deps.clock.now(),
    };
    this.records.set(record.messageId, record);

    const commitResult = await this.deps.runtimeCommit.commitMessage({
      messageId: input.envelope.messageId as string,
      envelopeDigest: input.envelope.integrityDigest,
      snapshotRef: observed.value.snapshotRef as string,
    });
    if (!commitResult.ok) {
      record = { ...record, phase: "failed", updatedAt: this.deps.clock.now() };
      this.records.set(record.messageId, record);
      return commitResult;
    }

    record = {
      ...record,
      phase: "committed",
      runtimeReceiptRef: commitResult.value.receiptRef,
      updatedAt: this.deps.clock.now(),
    };
    this.records.set(record.messageId, record);

    const verified = sealVerifiedEnvelope({
      envelope: input.envelope,
      verifiedAt: this.deps.clock.now(),
    });
    const dispatched = await this.deps.transport.dispatch(verified);
    if (!dispatched.ok) {
      record = { ...record, phase: "failed", updatedAt: this.deps.clock.now() };
      this.records.set(record.messageId, record);
      return dispatched;
    }

    this.deps.store.updateDelivery(input.envelope.messageId, {
      ...delivery,
      state: "dispatched",
      attempt: 1,
      dispatchedAt: this.deps.clock.now(),
    });

    record = {
      ...record,
      phase: "dispatched",
      attemptRef: dispatched.value.attemptRef,
      updatedAt: this.deps.clock.now(),
    };
    this.records.set(record.messageId, record);
    this.deps.events.emit(enqueuedEvent);
    this.deps.events.emit({
      eventId: commsEventId(`evt-disp-${input.envelope.messageId as string}`),
      storeSequence: this.deps.store.nextSequence(),
      kind: "MessageDispatched",
      occurredAt: this.deps.clock.now(),
      correlationId: input.envelope.metadata.correlationId as string,
      occurrenceId: input.envelope.metadata.occurrenceId as string,
      payload: { messageId: input.envelope.messageId as string },
    });

    return ok(record);
  }

  recover(messageId: string): MessagingSagaRecord | undefined {
    return this.records.get(messageId);
  }
}
