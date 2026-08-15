import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import type { CryptoVerifier } from "../../ports/cryptoVerifier.js";
import { domainSeparatedPayload, type SignatureDomain } from "../../canonical/signatureDomain.js";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function ed25519PublicKey(raw: Uint8Array) {
  if (raw.length !== 32) {
    throw new Error("ed25519 public key must be 32 bytes");
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(raw)]),
    format: "der",
    type: "spki",
  });
}

export function createMemoryCryptoVerifier(): CryptoVerifier {
  return {
    async verifySignature(
      domain: SignatureDomain,
      payload: Uint8Array,
      signature: Uint8Array,
      publicKey: Uint8Array,
    ) {
      try {
        const message = domainSeparatedPayload(domain, payload);
        const key = ed25519PublicKey(publicKey);
        return cryptoVerify(null, Buffer.from(message), key, Buffer.from(signature));
      } catch {
        return false;
      }
    },
  };
}
