import { type ActorRef } from "@cantilune/core";
import {
  type MessageId,
  type WireVersion,
  type RegistryVersion,
  type ChannelId,
  type ChannelGeneration,
} from "../foundation/messageId.js";
import { type CommunicationOperationCode } from "../protocol/communicationOperationRegistry.js";
import { type StableCommunicationMetadata } from "../foundation/stableCommunicationMetadata.js";
import { type PayloadDescriptor } from "./payloadDescriptor.js";

export type AckMode =
  "transportReceived" | "durablyAccepted" | "runtimeObserved" | "businessCommitted";

export interface CommunicationEnvelope {
  readonly wireVersion: WireVersion;
  readonly registryVersion: RegistryVersion;
  readonly messageId: MessageId;
  readonly operationCode: CommunicationOperationCode;
  readonly metadata: StableCommunicationMetadata;
  readonly sender: ActorRef;
  readonly recipient: ActorRef;
  readonly channelId: ChannelId;
  readonly channelGeneration: ChannelGeneration;
  readonly sequence: number;
  readonly replyToMessageId?: MessageId;
  readonly payload: PayloadDescriptor;
  readonly ackMode: AckMode;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly integrityDigest: string;
}

export interface VerifiedEnvelope {
  readonly envelope: CommunicationEnvelope;
  readonly verifiedAt: string;
  readonly signatureRef?: string;
}
