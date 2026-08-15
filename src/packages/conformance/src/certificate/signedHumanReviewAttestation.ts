import type { HumanReviewAttestation } from "../certificate/packageConformanceCertificate.js";

/** Human review attestation with cryptographic binding — required for production consumption. */
export interface SignedHumanReviewAttestation extends HumanReviewAttestation {
  readonly keyId: string;
  readonly signature: string;
  readonly attestationDigest: string;
}

export function isSignedHumanReviewAttestation(
  value: HumanReviewAttestation,
): value is SignedHumanReviewAttestation {
  return (
    typeof (value as SignedHumanReviewAttestation).keyId === "string" &&
    (value as SignedHumanReviewAttestation).keyId.length > 0 &&
    typeof (value as SignedHumanReviewAttestation).signature === "string" &&
    (value as SignedHumanReviewAttestation).signature.length > 0 &&
    typeof (value as SignedHumanReviewAttestation).attestationDigest === "string" &&
    (value as SignedHumanReviewAttestation).attestationDigest.length === 64
  );
}
