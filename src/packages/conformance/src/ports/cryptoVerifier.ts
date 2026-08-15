import type { SignatureDomain } from "../canonical/signatureDomain.js";

export interface CryptoVerifier {
  readonly verifySignature: (
    domain: SignatureDomain,
    payload: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ) => Promise<boolean>;
}
