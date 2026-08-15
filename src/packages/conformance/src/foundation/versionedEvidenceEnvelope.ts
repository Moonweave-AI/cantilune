import type {
  CanonicalEncodingVersion,
  DigestAlgorithm,
  SignatureAlgorithm,
} from "./conformanceId.js";
import type { ConformanceProfile, ClaimScope } from "./conformanceProfile.js";

export interface VersionedEvidenceEnvelope {
  readonly envelopeSchemaVersion: 1;
  readonly canonicalEncodingVersion: CanonicalEncodingVersion;
  readonly digestAlgorithm: DigestAlgorithm;
  readonly signatureAlgorithm: SignatureAlgorithm;
  readonly profile: ConformanceProfile;
  readonly claimScope: ClaimScope;
  readonly subjectDigest: string;
  readonly evidenceRootDigest: string;
  readonly payloadRef: string;
  readonly issuedAt: string;
  readonly notBefore?: string;
  readonly expiresAt?: string;
}
