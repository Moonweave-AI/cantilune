import {
  type AuthenticatedCommsContext,
  type AuthenticatedPeerContext,
} from "../peer/authenticatedPeerContext.js";
import { type VerifiedEnvelope } from "../envelope/communicationEnvelope.js";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";

const AUTH_SEAL = Symbol("@cantilune/comms/auth-seal");
const VERIFIED_SEAL = Symbol("@cantilune/comms/verified-seal");

type SealedPeer = AuthenticatedPeerContext & { readonly [AUTH_SEAL]: true };
type SealedVerified = VerifiedEnvelope & { readonly [VERIFIED_SEAL]: true };

/** Package-internal: seal context after IdentityVerifier success. */
export function sealAuthenticatedCommsContext(
  context: AuthenticatedCommsContext,
): AuthenticatedCommsContext {
  const peer = Object.freeze({
    ...context.peer,
    [AUTH_SEAL]: true as const,
  }) as SealedPeer;
  return Object.freeze({ ...context, peer, roles: Object.freeze([...context.roles]) });
}

/** Package-internal: seal verified envelope after ingress validation. */
export function sealVerifiedEnvelope(envelope: VerifiedEnvelope): VerifiedEnvelope {
  return Object.freeze({
    ...envelope,
    [VERIFIED_SEAL]: true as const,
  }) as SealedVerified;
}

export function assertAuthenticatedCommsContext(
  context: AuthenticatedCommsContext,
): { ok: true } | { ok: false; error: CommsViolation } {
  if ((context.peer as SealedPeer)[AUTH_SEAL] !== true) {
    return {
      ok: false,
      error: commsViolation("identity_unverified", "authenticate", "unsealed auth context"),
    };
  }
  return { ok: true };
}

export function assertVerifiedEnvelope(
  envelope: VerifiedEnvelope,
): { ok: true } | { ok: false; error: CommsViolation } {
  if ((envelope as SealedVerified)[VERIFIED_SEAL] !== true) {
    return {
      ok: false,
      error: commsViolation("identity_unverified", "ingress", "unsealed verified envelope"),
    };
  }
  return { ok: true };
}

export function isSealedAuthContext(context: AuthenticatedCommsContext): boolean {
  return (context.peer as SealedPeer)[AUTH_SEAL] === true;
}
