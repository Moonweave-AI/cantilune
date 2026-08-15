/** Branded conformance identifiers — one concept per type. */
export type ConformanceId = string & { readonly [brand]: "ConformanceId" };
export type CertificateId = string & { readonly [brand]: "CertificateId" };
export type VerificationRunId = string & { readonly [brand]: "VerificationRunId" };
export type EvidenceArtifactRef = string & { readonly [brand]: "EvidenceArtifactRef" };
export type TheoryBaselineRef = string & { readonly [brand]: "TheoryBaselineRef" };
export type VerifierBuildRef = string & { readonly [brand]: "VerifierBuildRef" };
export type PolicyRef = string & { readonly [brand]: "PolicyRef" };
export type TrustRootSetRef = string & { readonly [brand]: "TrustRootSetRef" };
export type RevocationCheckpointRef = string & { readonly [brand]: "RevocationCheckpointRef" };

declare const brand: unique symbol;

export const conformanceId = (value: string): ConformanceId => value as ConformanceId;
export const certificateId = (value: string): CertificateId => value as CertificateId;
export const verificationRunId = (value: string): VerificationRunId => value as VerificationRunId;
export const evidenceArtifactRef = (value: string): EvidenceArtifactRef =>
  value as EvidenceArtifactRef;

export type CanonicalEncodingVersion = "conformance-canonical/v1";
export type DigestAlgorithm = "sha256";
export type SignatureAlgorithm = "ed25519" | "none";

export const CANONICAL_ENCODING_VERSION: CanonicalEncodingVersion = "conformance-canonical/v1";
export const DEFAULT_DIGEST_ALGORITHM: DigestAlgorithm = "sha256";
