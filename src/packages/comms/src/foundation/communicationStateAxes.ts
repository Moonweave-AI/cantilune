/** π specification phase — separate from transport and occurrence lifecycle. */
export type CommunicationProtocolPhase =
  | "requested"
  | "sessionEstablished"
  | "admitted"
  | "reconnected"
  | "quiescentDeleted"
  | "completed";

export type OccurrenceLifecycle = "request" | "acknowledge" | "complete" | "failed";

export type EndpointDisposition = "successful" | "externalWait" | "deadlocked" | "productive";

export type TransportDeliveryState =
  | "created"
  | "queued"
  | "dispatched"
  | "retryWait"
  | "received"
  | "durablyAccepted"
  | "acknowledged"
  | "rejected"
  | "expired"
  | "deadLettered"
  | "cancelled";

export type DeliveryAckLevel =
  | "transportReceived"
  | "durablyAccepted"
  | "runtimeObserved"
  | "businessCommitted"
  | "rejected"
  | "expired";
