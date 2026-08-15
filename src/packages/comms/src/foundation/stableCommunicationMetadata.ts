import {
  type BindingGeneration,
  type CorrelationId,
  type EpochId,
  type EpochOrdinal,
  type IdempotencyKey,
  type OccurrenceId,
  type OperationTemplateRef,
  type SchemaEpochBinding,
  type SessionId,
} from "@cantilune/core";

/** Stable metadata carried on every comms occurrence — must align across admission/reconnect. */
export interface StableCommunicationMetadata {
  readonly epochId: EpochId;
  readonly epochOrdinal: EpochOrdinal;
  readonly bindingGeneration?: BindingGeneration;
  readonly bindingRef?: SchemaEpochBinding;
  readonly operationTemplateRef: OperationTemplateRef;
  readonly sessionId: SessionId;
  readonly correlationId: CorrelationId;
  readonly occurrenceId: OccurrenceId;
  readonly causationId?: CorrelationId;
  readonly idempotencyKey?: IdempotencyKey;
}
