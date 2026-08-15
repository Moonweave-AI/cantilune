import {
  type DescriptorRef,
  type ChannelId,
  type ChannelGeneration,
} from "../foundation/messageId.js";
import { type ActorRef, type EvidenceRef } from "@cantilune/core";
import { type StableCommunicationMetadata } from "../foundation/stableCommunicationMetadata.js";

export interface EndpointDelegationPlan {
  readonly oldEndpointRef: DescriptorRef;
  readonly newEndpointRef: DescriptorRef;
  readonly oldChannelId: ChannelId;
  readonly newChannelId: ChannelId;
  readonly channelGeneration: ChannelGeneration;
  readonly delegator: ActorRef;
  readonly delegatee: ActorRef;
  readonly authorizationRef: EvidenceRef;
  readonly oneTimeCapabilityRef: EvidenceRef;
  readonly metadata: StableCommunicationMetadata;
  readonly planDigest: string;
  readonly expiresAt: string;
}

export interface EndpointDelegationReceipt {
  readonly planDigest: string;
  readonly peerAckDigest: string;
  readonly delegatedAt: string;
  readonly oldEndpointTombstoneRef: string;
}

export interface FreshEndpointAllocation {
  readonly endpointRef: DescriptorRef;
  readonly channelId: ChannelId;
  readonly channelGeneration: ChannelGeneration;
  readonly allocatedAt: string;
}
