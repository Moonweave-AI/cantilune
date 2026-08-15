import type { VerificationDecision } from "../foundation/verificationDecision.js";

export interface VerificationCacheKey {
  readonly subjectDigest: string;
  readonly evidenceRootDigest: string;
  readonly verifierBuild: string;
  readonly policyVersion: string;
  readonly trustRootSetVersion: string;
  readonly revocationCheckpoint: string;
}

export interface VerificationCache {
  readonly get: (key: VerificationCacheKey) => VerificationDecision | undefined;
  readonly set: (key: VerificationCacheKey, decision: VerificationDecision) => void;
  readonly invalidateAll: () => void;
}

export function cacheKeyString(key: VerificationCacheKey): string {
  return [
    key.subjectDigest,
    key.evidenceRootDigest,
    key.verifierBuild,
    key.policyVersion,
    key.trustRootSetVersion,
    key.revocationCheckpoint,
  ].join("|");
}
