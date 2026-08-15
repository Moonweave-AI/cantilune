import { type IdempotencyKey, type SessionId } from "@cantilune/core";
import {
  type MessageId,
  type CommsStoreSequence,
  type ReconnectRecordId,
  type CloseRecordId,
  type ChannelGeneration,
  type DescriptorRef,
} from "../foundation/messageId.js";
import { type CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
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
import {
  type ReconnectCoordinatorRecord,
  type AdmissionReconnectReceipt,
} from "../reconnect/admissionReconnectPlan.js";
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

export interface OutboxAppendInput {
  readonly envelope: CommunicationEnvelope;
  readonly idempotencyKey: IdempotencyKey;
  readonly delivery: DeliveryRecord;
  readonly event: CommsEventEnvelope;
}

export interface InboxAcceptInput {
  readonly envelope: CommunicationEnvelope;
  readonly delivery: DeliveryRecord;
  readonly event: CommsEventEnvelope;
  readonly idempotencyKey: IdempotencyKey | string;
}

export interface ReconnectPersistInput {
  readonly record: ReconnectCoordinatorRecord;
  readonly receipt: AdmissionReconnectReceipt;
  readonly event: CommsEventEnvelope;
  readonly occurrence: CommunicationOccurrenceRecord;
}

export interface ClosePersistInput {
  readonly plan: QuiescentClosePlan;
  readonly receipt: QuiescentCloseReceipt;
  readonly event: CommsEventEnvelope;
}

export type PersistResult = "committed" | "idempotent_replay" | "conflict";

export interface CommsStore {
  snapshot(): CommsSnapshot;
  nextSequence(): CommsStoreSequence;

  getPeer(ref: DescriptorRef): PeerDescriptor | undefined;
  putPeer(descriptor: PeerDescriptor): void;

  getSessionBinding(sessionId: SessionId): SessionTransportBinding | undefined;
  casSessionBinding(input: {
    readonly sessionId: SessionId;
    readonly expectedGeneration: ChannelGeneration;
    readonly next: SessionTransportBinding;
  }): boolean;

  appendOutbox(input: OutboxAppendInput): PersistResult;
  appendInbox(input: InboxAcceptInput): PersistResult;
  getDelivery(messageId: MessageId): DeliveryRecord | undefined;
  getEnvelope(messageId: MessageId): CommunicationEnvelope | undefined;
  updateDelivery(messageId: MessageId, next: DeliveryRecord): boolean;
  putAck(ack: DeliveryAcknowledgement): void;

  putReconnect(record: ReconnectCoordinatorRecord): void;
  getReconnect(planId: ReconnectRecordId): ReconnectCoordinatorRecord | undefined;
  finalizeReconnect(input: ReconnectPersistInput): PersistResult;

  putClosePlan(plan: QuiescentClosePlan): void;
  finalizeClose(input: ClosePersistInput): PersistResult;
  getForceClose(planId: CloseRecordId): ForceCloseRecord | undefined;
  putForceClose(record: ForceCloseRecord): void;

  appendOccurrence(record: CommunicationOccurrenceRecord): void;
  appendEvent(event: CommsEventEnvelope): void;
  readEvents(since?: CommsStoreSequence): readonly CommsEventEnvelope[];

  claimIdempotency(key: IdempotencyKey, digest: string): "claimed" | "replay" | "conflict";
  putDeadLetter(record: DeadLetterRecord): void;

  putDelegation(plan: EndpointDelegationPlan): void;
  putDelegationReceipt(receipt: EndpointDelegationReceipt): void;
  putHandshake(handshake: SessionHandshake): void;
}

export interface CommsSnapshot {
  readonly frozen: boolean;
  readonly lastSequence: CommsStoreSequence;
  readonly peers: ReadonlyMap<string, PeerDescriptor>;
  readonly sessions: ReadonlyMap<string, SessionTransportBinding>;
  readonly outbox: readonly DeliveryRecord[];
  readonly inbox: readonly DeliveryRecord[];
  readonly reconnects: ReadonlyMap<string, ReconnectCoordinatorRecord>;
  readonly occurrences: readonly CommunicationOccurrenceRecord[];
  readonly events: readonly CommsEventEnvelope[];
}
