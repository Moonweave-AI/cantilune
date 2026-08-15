import { type Result } from "@cantilune/core";
import { type CommsViolation } from "../foundation/commsViolation.js";
import { type PeerDescriptor } from "../peer/peerDescriptor.js";
import {
  type AuthenticatedPeerContext,
  type AuthenticatedCommsContext,
} from "../peer/authenticatedPeerContext.js";

export interface IdentityVerifier {
  verifyPeer(input: {
    readonly descriptor: PeerDescriptor;
    readonly credentialRef: string;
    readonly channelBindingMaterial: string;
  }): Promise<Result<AuthenticatedPeerContext, CommsViolation>>;
}

export interface EndpointPolicy {
  assertEndpointAllowed(uri: string): Result<void, CommsViolation>;
}

export interface ReplayProtector {
  checkReplay(input: {
    readonly messageDigest: string;
    readonly issuedAt: string;
    readonly senderInstanceId: string;
  }): Result<void, CommsViolation>;
  recordSeen(messageDigest: string, expiresAt: string): void;
}

export interface CommsAuthorizer {
  authorize(input: {
    readonly action: string;
    readonly context: AuthenticatedCommsContext;
    readonly resource?: string;
  }): Result<void, CommsViolation>;
}

export interface EStopGate {
  isFrozen(): boolean;
  setFrozen(frozen: boolean): void;
}

export interface KeyResolver {
  resolveVerificationKey(keyRef: string): Result<string, CommsViolation>;
}

export interface Signer {
  signDigest(digest: string): Promise<Result<string, CommsViolation>>;
}
