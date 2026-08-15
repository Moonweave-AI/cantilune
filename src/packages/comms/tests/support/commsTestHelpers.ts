import type { AuthenticatedCommsContext } from "../../src/peer/authenticatedPeerContext.js";
import type { CommunicationEnvelope } from "../../src/envelope/communicationEnvelope.js";
import { sealAuthenticatedCommsContext } from "../../src/security/commsCapability.js";
import { computeEnvelopeIntegrityDigest } from "../../src/codec/strictWireCodec.js";

/** Test-only helper — production auth contexts must come from IdentityVerifier. */
export function sealTestAuthContext(context: AuthenticatedCommsContext): AuthenticatedCommsContext {
  return sealAuthenticatedCommsContext(context);
}

export function withIntegrityDigest(
  envelope: Omit<CommunicationEnvelope, "integrityDigest">,
): CommunicationEnvelope {
  const integrityDigest = computeEnvelopeIntegrityDigest(envelope);
  return { ...envelope, integrityDigest };
}
