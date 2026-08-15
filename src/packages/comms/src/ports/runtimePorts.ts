import {
  type Result,
  type ActivationDomainId,
  type ActorRef,
  type ContentRef,
  type OperationTemplateRef,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
  type SessionId,
  type SnapshotRef,
} from "@cantilune/core";
import { type CommsViolation } from "../foundation/commsViolation.js";
import { type AdmissionReconnectPlan } from "../reconnect/admissionReconnectPlan.js";
import {
  type DescriptorRef,
  type MessageId,
  type ChannelId,
  type DeliveryAttemptId,
  type ReconnectRecordId,
  type CloseRecordId,
  type CommsEventId,
} from "../foundation/messageId.js";
import { type CommsEventEnvelope } from "../events/commsEvent.js";

export interface AdmissionReceiptResolver {
  resolve(receiptRef: string): Promise<SchemaAdmissionReceipt | undefined>;
  buildReconnectPlan(input: {
    readonly receipt: SchemaAdmissionReceipt;
    readonly sessionId: SessionId;
    readonly operationTemplateRef: OperationTemplateRef;
    readonly oldEndpointRef: DescriptorRef;
    readonly newEndpointRef: DescriptorRef;
    readonly authorizationRef: string;
    readonly expiresAt: string;
  }): Result<AdmissionReconnectPlan, CommsViolation>;
}

export interface RuntimeObservationPort {
  observe(input: {
    readonly source: ActorRef;
    readonly payloadRef: ContentRef;
    readonly principal: ActorRef;
  }): Promise<Result<{ readonly snapshotRef: SnapshotRef }, CommsViolation>>;
}

export interface RuntimeCommitPort {
  commitReconnect(input: {
    readonly planDigest: string;
    readonly admissionId: string;
  }): Promise<Result<{ readonly receiptRef: string }, CommsViolation>>;
  commitMessage(input: {
    readonly messageId: string;
    readonly envelopeDigest: string;
    readonly snapshotRef: string;
  }): Promise<Result<{ readonly receiptRef: string }, CommsViolation>>;
}

export interface QuiescenceProbe {
  resourcesClear(): Promise<boolean>;
  sessionsQuiescent(): Promise<boolean>;
}

export interface SessionAuthority {
  isController(sessionId: SessionId, actor: ActorRef): boolean;
  isMember(sessionId: SessionId, actor: ActorRef): boolean;
}

export interface ActiveBindingResolver {
  getActiveBinding(domainId: ActivationDomainId): SchemaEpochBinding | undefined;
}

export interface PayloadResolver {
  resolve(contentRef: ContentRef): Promise<Uint8Array | undefined>;
}

export interface EventSink {
  emit(event: CommsEventEnvelope): void;
}

export interface Clock {
  now(): string;
}

export interface IdGenerator {
  messageId(): MessageId;
  channelId(): ChannelId;
  reconnectRecordId(): ReconnectRecordId;
  closeRecordId(): CloseRecordId;
  deliveryAttemptId(): DeliveryAttemptId;
  commsEventId(): CommsEventId;
}

export type { CommsStoreSequence } from "../foundation/messageId.js";
