import { type SessionId, type SnapshotRef, type RuntimeInstanceId } from "@cantilune/core";
import {
  type ChannelId,
  type ChannelGeneration,
  type DescriptorRef,
} from "../foundation/messageId.js";
import { type NegotiatedProtocol } from "../peer/negotiatedProtocol.js";
import { type StableCommunicationMetadata } from "../foundation/stableCommunicationMetadata.js";

export type SessionTransportStatus =
  "proposed" | "negotiating" | "active" | "draining" | "quiescent" | "closed";

export interface SessionTransportBinding {
  readonly sessionId: SessionId;
  readonly authoritativeSnapshotRef: SnapshotRef;
  readonly localRuntimeInstanceId: RuntimeInstanceId;
  readonly remoteRuntimeInstanceId: RuntimeInstanceId;
  readonly channelId: ChannelId;
  readonly channelGeneration: ChannelGeneration;
  readonly localEndpoint: DescriptorRef;
  readonly remoteEndpoint: DescriptorRef;
  readonly negotiated: NegotiatedProtocol;
  readonly schemaEpochId: string;
  readonly status: SessionTransportStatus;
  readonly outboundSequence: number;
  readonly inboundSequence: number;
  readonly leaseExpiresAt?: string;
  readonly previousChannelId?: ChannelId;
  readonly establishedAt: string;
  readonly updatedAt: string;
}

export interface SessionHandshake {
  readonly sessionId: SessionId;
  readonly authoritativeSnapshotRef: SnapshotRef;
  readonly requester: RuntimeInstanceId;
  readonly acceptor: RuntimeInstanceId;
  readonly offeredProtocols: readonly NegotiatedProtocol[];
  readonly selectedProtocol?: NegotiatedProtocol;
  readonly endpointRef: DescriptorRef;
  readonly transcriptDigest: string;
  readonly authEvidenceRef: string;
  readonly metadata: StableCommunicationMetadata;
  readonly expiresAt: string;
}

export type SessionLifecycleState =
  "requested" | "accepted" | "rejected" | "established" | "closed";
