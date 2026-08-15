import {
  type MessageId,
  type ChannelId,
  type ChannelGeneration,
  type DeliveryAttemptId,
} from "../foundation/messageId.js";
import {
  type TransportDeliveryState,
  type DeliveryAckLevel,
} from "../foundation/communicationStateAxes.js";
import { type SessionId, type RuntimeInstanceId } from "@cantilune/core";

export interface DeliveryRecord {
  readonly deliveryId: DeliveryAttemptId;
  readonly envelopeRef: string;
  readonly envelopeDigest: string;
  readonly state: TransportDeliveryState;
  readonly attempt: number;
  readonly nextAttemptAt?: string;
  readonly lastSafeError?: string;
  readonly createdAt: string;
  readonly dispatchedAt?: string;
  readonly ackAt?: string;
  readonly terminalAt?: string;
}

export interface DeliveryAcknowledgement {
  readonly messageId: MessageId;
  readonly sessionId: SessionId;
  readonly channelId: ChannelId;
  readonly channelGeneration: ChannelGeneration;
  readonly sequence: number;
  readonly envelopeDigest: string;
  readonly peerInstanceId: RuntimeInstanceId;
  readonly level: DeliveryAckLevel;
  readonly status: "accepted" | "rejected" | "expired";
  readonly reason?: string;
  readonly receivedAt: string;
  readonly integrityDigest: string;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 16,
  baseDelayMs: 100,
  maxDelayMs: 60_000,
  jitterRatio: 0.2,
};

export interface DeadLetterRecord {
  readonly deliveryId: DeliveryAttemptId;
  readonly envelopeRef: string;
  readonly reason: string;
  readonly quarantinedAt: string;
}
