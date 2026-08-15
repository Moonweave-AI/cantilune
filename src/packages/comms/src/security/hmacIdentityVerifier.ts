import { createHmac, timingSafeEqual } from "node:crypto";
import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type PeerDescriptor } from "../peer/peerDescriptor.js";
import { type AuthenticatedPeerContext } from "../peer/authenticatedPeerContext.js";
import { type IdentityVerifier, type KeyResolver } from "./identityVerifier.js";
import { descriptorRef } from "../foundation/messageId.js";

export interface HmacIdentityVerifierOptions {
  readonly keyResolver: KeyResolver;
  readonly clock: { now(): string };
  readonly ttlMs?: number;
}

function digestHex(secret: string, material: string): string {
  return createHmac("sha256", secret).update(material).digest("hex");
}

/** Production-grade HMAC peer authentication (test + file-backed keys). */
export class HmacIdentityVerifier implements IdentityVerifier {
  constructor(private readonly options: HmacIdentityVerifierOptions) {}

  async verifyPeer(input: {
    readonly descriptor: PeerDescriptor;
    readonly credentialRef: string;
    readonly channelBindingMaterial: string;
  }): Promise<Result<AuthenticatedPeerContext, CommsViolation>> {
    const keyResult = this.options.keyResolver.resolveVerificationKey(input.credentialRef);
    if (!keyResult.ok) {
      return keyResult;
    }

    const parts = input.channelBindingMaterial.split("|");
    if (parts.length !== 3) {
      return err(commsViolation("identity_unverified", "authenticate", "invalid binding material"));
    }
    const [nonce, issuedAt, signature] = parts;
    if (nonce === undefined || issuedAt === undefined || signature === undefined) {
      return err(
        commsViolation("identity_unverified", "authenticate", "malformed binding material"),
      );
    }

    if (input.descriptor.actors.length === 0) {
      return err(commsViolation("identity_unverified", "authenticate", "descriptor has no actors"));
    }

    const ttl = this.options.ttlMs ?? 300_000;
    const issuedMs = Date.parse(issuedAt);
    const age = Date.now() - issuedMs;
    if (Number.isNaN(issuedMs) || age > ttl || age < -60_000) {
      return err(
        commsViolation("wire_expired", "authenticate", "credential expired or clock skew"),
      );
    }

    const expected = digestHex(
      keyResult.value,
      `${input.descriptor.descriptorRef as string}:${nonce}:${issuedAt}`,
    );
    const provided = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
      return err(commsViolation("identity_unverified", "authenticate", "signature mismatch"));
    }

    const authenticatedAt = this.options.clock.now();
    const expiresAt = new Date(Date.parse(authenticatedAt) + ttl).toISOString();
    return ok({
      runtimeInstanceId: input.descriptor.runtimeInstanceId,
      principal: input.descriptor.actors[0]!,
      descriptorRef: descriptorRef(input.descriptor.descriptorRef as string),
      descriptorDigest: input.descriptor.digest,
      authenticationMethod: "hmac-sha256",
      channelBindingDigest: expected,
      evidenceRef: input.credentialRef,
      authenticatedAt,
      expiresAt,
    });
  }
}

export function createHmacBindingMaterial(
  secret: string,
  descriptorRef: string,
  nonce: string,
  issuedAt: string,
): string {
  const signature = digestHex(secret, `${descriptorRef}:${nonce}:${issuedAt}`);
  return `${nonce}|${issuedAt}|${signature}`;
}
