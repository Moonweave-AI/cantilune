/**
 * Same-process identity: accept descriptors that name a concrete ActorRef.
 * Ingress still checks wire sender matches the authenticated principal.
 */
import { type Result, err, ok } from "@cantilune/core";
import type { IdentityVerifier, CommsViolation } from "@cantilune/comms";
import { commsViolation } from "@cantilune/comms";

export function createActorIdIdentityVerifier(): IdentityVerifier {
  return {
    async verifyPeer(input) {
      const principal = input.descriptor.actors[0];
      if (principal === undefined) {
        return err(
          commsViolation("identity_unverified", "authenticate", "descriptor has no actors"),
        ) as Result<never, CommsViolation>;
      }
      const now = new Date().toISOString();
      return ok({
        runtimeInstanceId: input.descriptor.runtimeInstanceId,
        principal,
        descriptorRef: input.descriptor.descriptorRef as never,
        descriptorDigest: input.descriptor.digest,
        authenticationMethod: "actor-id-pin",
        channelBindingDigest: input.channelBindingMaterial,
        evidenceRef: input.credentialRef,
        authenticatedAt: now,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
    },
  };
}
