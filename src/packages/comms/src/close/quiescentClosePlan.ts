import { type SessionId } from "@cantilune/core";
import {
  type ChannelId,
  type ChannelGeneration,
  type CloseRecordId,
  type CommsStoreSequence,
} from "../foundation/messageId.js";

export interface QuiescentClosePlan {
  readonly planId: CloseRecordId;
  readonly sessionId: SessionId;
  readonly channelId: ChannelId;
  readonly channelGeneration: ChannelGeneration;
  readonly sendBarrierApplied: boolean;
  readonly pendingOutbox: number;
  readonly pendingInbox: number;
  readonly pendingInflight: number;
  readonly peerShutdownAckRef?: string;
  readonly resourcesClearEvidenceRef?: string;
  readonly sessionsQuiescentEvidenceRef?: string;
  readonly authorizationRef: string;
  readonly expiresAt: string;
}

export type QuiescentCloseState =
  | "proposed"
  | "barrierApplied"
  | "peerAcknowledged"
  | "runtimeVerified"
  | "tombstoned"
  | "completed"
  | "failed";

export interface QuiescentCloseReceipt {
  readonly planId: CloseRecordId;
  readonly tombstoneRef: string;
  readonly storeSequence: CommsStoreSequence;
  readonly closedAt: string;
}

export interface ForceCloseRecord {
  readonly planId: CloseRecordId;
  readonly sessionId: SessionId;
  readonly operatorRef: string;
  readonly reason: string;
  readonly forcedAt: string;
}
