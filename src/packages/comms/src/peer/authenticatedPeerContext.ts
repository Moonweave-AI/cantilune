import { type ActorRef, type RuntimeInstanceId } from "@cantilune/core";
import { type DescriptorRef } from "../foundation/messageId.js";

/** Opaque authenticated peer context — constructed only by IdentityVerifier. */
export interface AuthenticatedPeerContext {
  readonly runtimeInstanceId: RuntimeInstanceId;
  readonly principal: ActorRef;
  readonly descriptorRef: DescriptorRef;
  readonly descriptorDigest: string;
  readonly authenticationMethod: string;
  readonly channelBindingDigest: string;
  readonly evidenceRef: string;
  readonly authenticatedAt: string;
  readonly expiresAt: string;
}

export interface AuthenticatedCommsContext {
  readonly peer: AuthenticatedPeerContext;
  readonly roles: readonly string[];
}
