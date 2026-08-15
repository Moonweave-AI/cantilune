import { type Result } from "@cantilune/core";
import { type CommsViolation } from "../foundation/commsViolation.js";
import {
  type CommunicationEnvelope,
  type VerifiedEnvelope,
} from "../envelope/communicationEnvelope.js";
import { type SessionHandshake } from "../session/sessionTransportBinding.js";
import { type DescriptorRef } from "../foundation/messageId.js";
import { type PeerDescriptor } from "../peer/peerDescriptor.js";

export interface TransportContext {
  readonly transport: string;
  readonly remoteAddress?: string;
  readonly tlsVerified?: boolean;
}

export interface CommunicationTransport {
  readonly transportId: string;
  dispatch(
    envelope: VerifiedEnvelope,
  ): Promise<Result<{ readonly attemptRef: string }, CommsViolation>>;
  receive(): Promise<Result<Uint8Array, CommsViolation>>;
  handshake(
    request: SessionHandshake,
  ): Promise<Result<{ readonly ackDigest: string }, CommsViolation>>;
}

export interface TransportRegistry {
  get(transportId: string): CommunicationTransport | undefined;
  register(transport: CommunicationTransport): void;
}

export interface PeerDirectory {
  resolve(descriptorRef: DescriptorRef): Promise<PeerDescriptor | undefined>;
  register(descriptor: PeerDescriptor): void;
}

export interface MessageConsumer {
  consume(envelope: CommunicationEnvelope): Promise<Result<void, CommsViolation>>;
}

import type { FreshEndpointAllocation } from "../mobility/endpointDelegation.js";

export interface FreshEndpointAllocator {
  allocate(): Result<FreshEndpointAllocation, CommsViolation>;
}
