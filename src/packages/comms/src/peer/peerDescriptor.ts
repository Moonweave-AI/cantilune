import {
  type ActivationDomainId,
  type ActorRef,
  type ContentDigest,
  type EvidenceRef,
  type RuntimeInstanceId,
  type SchemaRef,
} from "@cantilune/core";
import { type DescriptorRef, type WireVersion } from "../foundation/messageId.js";
import { type CommunicationOperationCode } from "../protocol/communicationOperationRegistry.js";

export type PeerCompatibility =
  "ready" | "admissionRequired" | "incompatible" | "degraded" | "quarantined";

export interface PeerEndpoint {
  readonly endpointRef: DescriptorRef;
  readonly transport: string;
  readonly uri: string;
  readonly wireVersions: readonly WireVersion[];
  readonly maxFrameBytes: number;
}

export interface PeerDescriptor {
  readonly descriptorRef: DescriptorRef;
  readonly digest: ContentDigest;
  readonly runtimeInstanceId: RuntimeInstanceId;
  readonly activationDomainId: ActivationDomainId;
  readonly actors: readonly ActorRef[];
  readonly endpoints: readonly PeerEndpoint[];
  readonly supportedWireVersions: readonly WireVersion[];
  readonly supportedTransports: readonly string[];
  readonly supportedFeatures: readonly string[];
  readonly supportedOperations: readonly CommunicationOperationCode[];
  readonly schemaBinding: SchemaRef;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly provenance: string;
}

export interface PeerCompatibilityResult {
  readonly compatibility: PeerCompatibility;
  readonly negotiatedWireVersion?: WireVersion;
  readonly negotiatedTransport?: string;
  readonly reason?: string;
}
