import { type CommsEventId, type CommsStoreSequence } from "../foundation/messageId.js";

export type CommsEventKind =
  | "PeerAuthenticated"
  | "PeerRejected"
  | "SessionRequested"
  | "SessionEstablished"
  | "SessionRejected"
  | "MessageEnqueued"
  | "MessageDispatched"
  | "MessageReceived"
  | "MessageAcknowledged"
  | "MessageRejected"
  | "MessageExpired"
  | "MessageDeadLettered"
  | "BackpressureApplied"
  | "EndpointDelegated"
  | "ReconnectPrepared"
  | "ReconnectCommitted"
  | "ReconnectRecovered"
  | "QuiescenceStarted"
  | "QuiescenceBlocked"
  | "SessionClosed"
  | "ProtocolMismatch"
  | "SecurityRejected";

export interface CommsEventEnvelope {
  readonly eventId: CommsEventId;
  readonly storeSequence: CommsStoreSequence;
  readonly kind: CommsEventKind;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly occurrenceId?: string;
  readonly payload: Record<string, string | number | boolean>;
}
