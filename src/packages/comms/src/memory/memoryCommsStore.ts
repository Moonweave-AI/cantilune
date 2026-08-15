import { type IdempotencyKey, type SessionId } from "@cantilune/core";
import {
  commsStoreSequence,
  type MessageId,
  type CommsStoreSequence,
  type ReconnectRecordId,
  type CloseRecordId,
  type DescriptorRef,
  type ChannelGeneration,
} from "../foundation/messageId.js";
import {
  type CommsStore,
  type CommsSnapshot,
  type OutboxAppendInput,
  type InboxAcceptInput,
  type ReconnectPersistInput,
  type ClosePersistInput,
  type PersistResult,
} from "../ports/commsStore.js";
import {
  type DeliveryRecord,
  type DeliveryAcknowledgement,
  type DeadLetterRecord,
} from "../delivery/deliveryRecord.js";
import {
  type SessionTransportBinding,
  type SessionHandshake,
} from "../session/sessionTransportBinding.js";
import { type PeerDescriptor } from "../peer/peerDescriptor.js";
import { type ReconnectCoordinatorRecord } from "../reconnect/admissionReconnectPlan.js";
import {
  type QuiescentClosePlan,
  type QuiescentCloseReceipt,
  type ForceCloseRecord,
} from "../close/quiescentClosePlan.js";
import { type CommunicationOccurrenceRecord } from "../protocol/communicationOccurrenceRecord.js";
import { type CommsEventEnvelope } from "../events/commsEvent.js";
import {
  type EndpointDelegationPlan,
  type EndpointDelegationReceipt,
} from "../mobility/endpointDelegation.js";
import { type CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
import { type CommsPersistedSnapshot } from "../foundation/commsPersistedSnapshot.js";

export class MemoryCommsStore implements CommsStore {
  private frozen = false;
  private sequence = 0;
  private peers = new Map<string, PeerDescriptor>();
  private sessions = new Map<string, SessionTransportBinding>();
  private outbox: DeliveryRecord[] = [];
  private inbox: DeliveryRecord[] = [];
  private deliveries = new Map<MessageId, DeliveryRecord>();
  private envelopes = new Map<MessageId, CommunicationEnvelope>();
  private acks: DeliveryAcknowledgement[] = [];
  private reconnects = new Map<string, ReconnectCoordinatorRecord>();
  private closePlans = new Map<string, QuiescentClosePlan>();
  private closeReceipts = new Map<string, QuiescentCloseReceipt>();
  private forceCloses = new Map<string, ForceCloseRecord>();
  private occurrences: CommunicationOccurrenceRecord[] = [];
  private events: CommsEventEnvelope[] = [];
  private idempotency = new Map<IdempotencyKey, string>();
  private deadLetters: DeadLetterRecord[] = [];
  private delegations = new Map<string, EndpointDelegationPlan>();
  private delegationReceipts = new Map<string, EndpointDelegationReceipt>();
  private handshakes = new Map<string, SessionHandshake>();

  snapshot(): CommsSnapshot {
    return {
      frozen: this.frozen,
      lastSequence: commsStoreSequence(this.sequence),
      peers: new Map(this.peers),
      sessions: new Map(this.sessions),
      outbox: [...this.outbox],
      inbox: [...this.inbox],
      reconnects: new Map(this.reconnects),
      occurrences: [...this.occurrences],
      events: [...this.events],
    };
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  nextSequence(): CommsStoreSequence {
    this.sequence += 1;
    return commsStoreSequence(this.sequence);
  }

  getPeer(ref: DescriptorRef): PeerDescriptor | undefined {
    return this.peers.get(ref as string);
  }

  putPeer(descriptor: PeerDescriptor): void {
    this.peers.set(descriptor.descriptorRef as string, descriptor);
  }

  getSessionBinding(sessionId: SessionId): SessionTransportBinding | undefined {
    return this.sessions.get(sessionId as string);
  }

  casSessionBinding(input: {
    readonly sessionId: SessionId;
    readonly expectedGeneration: ChannelGeneration;
    readonly next: SessionTransportBinding;
  }): boolean {
    const current = this.sessions.get(input.sessionId as string);
    if (current !== undefined && current.channelGeneration !== input.expectedGeneration) {
      return false;
    }
    this.sessions.set(input.sessionId as string, input.next);
    return true;
  }

  appendOutbox(input: OutboxAppendInput): PersistResult {
    const claim = this.claimIdempotency(input.idempotencyKey, input.envelope.integrityDigest);
    if (claim === "conflict") {
      return "conflict";
    }
    if (claim === "replay") {
      return "idempotent_replay";
    }
    this.outbox.push(input.delivery);
    this.deliveries.set(input.envelope.messageId, input.delivery);
    this.envelopes.set(input.envelope.messageId, input.envelope);
    this.appendEvent(input.event);
    return "committed";
  }

  appendInbox(input: InboxAcceptInput): PersistResult {
    const digest = input.envelope.integrityDigest;
    const claim = this.claimIdempotency(input.idempotencyKey as IdempotencyKey, digest);
    if (claim === "conflict") {
      return "conflict";
    }
    if (claim === "replay") {
      return "idempotent_replay";
    }
    if (this.deliveries.has(input.envelope.messageId)) {
      return "idempotent_replay";
    }
    this.inbox.push(input.delivery);
    this.deliveries.set(input.envelope.messageId, input.delivery);
    this.envelopes.set(input.envelope.messageId, input.envelope);
    this.appendEvent(input.event);
    return "committed";
  }

  updateDelivery(messageId: MessageId, next: DeliveryRecord): boolean {
    const current = this.deliveries.get(messageId);
    if (current === undefined) {
      return false;
    }
    this.deliveries.set(messageId, next);
    const outIdx = this.outbox.findIndex((d) => d.envelopeRef === (messageId as string));
    if (outIdx >= 0) {
      this.outbox[outIdx] = next;
    }
    const inIdx = this.inbox.findIndex((d) => d.envelopeRef === (messageId as string));
    if (inIdx >= 0) {
      this.inbox[inIdx] = next;
    }
    return true;
  }

  getDelivery(messageId: MessageId): DeliveryRecord | undefined {
    return this.deliveries.get(messageId);
  }

  getEnvelope(messageId: MessageId): CommunicationEnvelope | undefined {
    return this.envelopes.get(messageId);
  }

  putAck(ack: DeliveryAcknowledgement): void {
    this.acks.push(ack);
  }

  putReconnect(record: ReconnectCoordinatorRecord): void {
    this.reconnects.set(record.plan.planId as string, record);
  }

  getReconnect(planId: ReconnectRecordId): ReconnectCoordinatorRecord | undefined {
    return this.reconnects.get(planId as string);
  }

  finalizeReconnect(input: ReconnectPersistInput): PersistResult {
    const existing = this.reconnects.get(input.record.plan.planId as string);
    if (existing?.state === "completed") {
      return "idempotent_replay";
    }
    this.reconnects.set(input.record.plan.planId as string, input.record);
    this.occurrences.push(input.occurrence);
    this.appendEvent(input.event);
    return "committed";
  }

  putClosePlan(plan: QuiescentClosePlan): void {
    this.closePlans.set(plan.planId as string, plan);
  }

  finalizeClose(input: ClosePersistInput): PersistResult {
    this.closeReceipts.set(input.receipt.planId as string, input.receipt);
    this.appendEvent(input.event);
    return "committed";
  }

  getForceClose(planId: CloseRecordId): ForceCloseRecord | undefined {
    return this.forceCloses.get(planId as string);
  }

  putForceClose(record: ForceCloseRecord): void {
    this.forceCloses.set(record.planId as string, record);
  }

  appendOccurrence(record: CommunicationOccurrenceRecord): void {
    this.occurrences.push(record);
  }

  appendEvent(event: CommsEventEnvelope): void {
    this.events.push(event);
  }

  readEvents(since?: CommsStoreSequence): readonly CommsEventEnvelope[] {
    if (since === undefined) {
      return [...this.events];
    }
    const floor = since as number;
    return this.events.filter((event) => (event.storeSequence as number) > floor);
  }

  claimIdempotency(key: IdempotencyKey, digest: string): "claimed" | "replay" | "conflict" {
    const existing = this.idempotency.get(key);
    if (existing === undefined) {
      this.idempotency.set(key, digest);
      return "claimed";
    }
    if (existing === digest) {
      return "replay";
    }
    return "conflict";
  }

  putDeadLetter(record: DeadLetterRecord): void {
    this.deadLetters.push(record);
  }

  putDelegation(plan: EndpointDelegationPlan): void {
    this.delegations.set(plan.planDigest, plan);
  }

  putDelegationReceipt(receipt: EndpointDelegationReceipt): void {
    this.delegationReceipts.set(receipt.planDigest, receipt);
  }

  putHandshake(handshake: SessionHandshake): void {
    this.handshakes.set(handshake.sessionId as string, handshake);
  }

  exportPersistedSnapshot(): CommsPersistedSnapshot {
    return {
      version: 1,
      frozen: this.frozen,
      sequence: this.sequence,
      peers: [...this.peers.entries()],
      sessions: [...this.sessions.entries()],
      outbox: [...this.outbox],
      inbox: [...this.inbox],
      deliveries: [...this.deliveries.entries()],
      envelopes: [...this.envelopes.entries()],
      acks: [...this.acks],
      reconnects: [...this.reconnects.entries()],
      closePlans: [...this.closePlans.entries()],
      closeReceipts: [...this.closeReceipts.entries()],
      forceCloses: [...this.forceCloses.entries()],
      occurrences: [...this.occurrences],
      events: [...this.events],
      idempotency: [...this.idempotency.entries()],
      deadLetters: [...this.deadLetters],
      delegations: [...this.delegations.entries()],
      delegationReceipts: [...this.delegationReceipts.entries()],
      handshakes: [...this.handshakes.entries()],
    };
  }

  restorePersistedSnapshot(raw: CommsPersistedSnapshot): void {
    this.frozen = raw.frozen;
    this.sequence = raw.sequence;
    this.peers = new Map(raw.peers as [string, PeerDescriptor][]);
    this.sessions = new Map(raw.sessions as [string, SessionTransportBinding][]);
    this.outbox = [...(raw.outbox as DeliveryRecord[])];
    this.inbox = [...(raw.inbox as DeliveryRecord[])];
    this.deliveries = new Map(raw.deliveries as [MessageId, DeliveryRecord][]);
    this.envelopes = new Map(raw.envelopes as [MessageId, CommunicationEnvelope][]);
    this.acks = [...(raw.acks as DeliveryAcknowledgement[])];
    this.reconnects = new Map(raw.reconnects as [string, ReconnectCoordinatorRecord][]);
    this.closePlans = new Map(raw.closePlans as [string, QuiescentClosePlan][]);
    this.closeReceipts = new Map(raw.closeReceipts as [string, QuiescentCloseReceipt][]);
    this.forceCloses = new Map(raw.forceCloses as [string, ForceCloseRecord][]);
    this.occurrences = [...(raw.occurrences as CommunicationOccurrenceRecord[])];
    this.events = [...(raw.events as CommsEventEnvelope[])];
    this.idempotency = new Map(raw.idempotency as [IdempotencyKey, string][]);
    this.deadLetters = [...(raw.deadLetters as DeadLetterRecord[])];
    this.delegations = new Map(raw.delegations as [string, EndpointDelegationPlan][]);
    this.delegationReceipts = new Map(
      raw.delegationReceipts as [string, EndpointDelegationReceipt][],
    );
    this.handshakes = new Map(raw.handshakes as [string, SessionHandshake][]);
  }
}
