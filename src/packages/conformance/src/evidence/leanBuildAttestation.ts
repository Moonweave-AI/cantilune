import type { ContentDigest } from "@cantilune/core";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js"; // NOSONAR — single import, false positive

export const LEAN_BUILD_ATTESTATION_SCHEMA_VERSION = 2 as const;

/** Lean clean-build attestation — binds repo, toolchain, proof manifest, builder, and signature. */
export interface LeanBuildAttestation {
  readonly attestationSchemaVersion: typeof LEAN_BUILD_ATTESTATION_SCHEMA_VERSION;
  readonly attestationRef: string;
  readonly gitCommit: string;
  readonly gitTree: string;
  readonly leanToolchainDigest: ContentDigest;
  readonly proofManifestDigest: ContentDigest;
  readonly buildLogDigest: ContentDigest;
  readonly builderIdentity: string;
  readonly keyId: string;
  readonly signature: string;
  readonly notBefore: string;
  readonly expiresAt: string;
}

const PROOF_MANIFEST_REF = /^proof-manifest\/[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;

export function isProofManifestRef(value: string): boolean {
  return PROOF_MANIFEST_REF.test(value);
}

export function leanBuildAttestationComplete(attestation: LeanBuildAttestation): boolean {
  return (
    attestation.attestationSchemaVersion === LEAN_BUILD_ATTESTATION_SCHEMA_VERSION &&
    attestation.attestationRef.length > 0 &&
    GIT_SHA.test(attestation.gitCommit) &&
    GIT_SHA.test(attestation.gitTree) &&
    attestation.builderIdentity.length > 0 &&
    attestation.keyId.length > 0 &&
    attestation.signature.length > 0 &&
    attestation.notBefore.length > 0 &&
    attestation.expiresAt.length > 0 &&
    isSha256HexDigest(attestation.leanToolchainDigest as string) &&
    isSha256HexDigest(attestation.proofManifestDigest as string) &&
    isSha256HexDigest(attestation.buildLogDigest as string)
  );
}

export function computeLeanBuildAttestationDigest(
  attestation: LeanBuildAttestation,
): ContentDigest {
  return computeEvidenceDigest({
    schema: LEAN_BUILD_ATTESTATION_SCHEMA_VERSION,
    attestationRef: attestation.attestationRef,
    gitCommit: attestation.gitCommit,
    gitTree: attestation.gitTree,
    leanToolchainDigest: attestation.leanToolchainDigest,
    proofManifestDigest: attestation.proofManifestDigest,
    buildLogDigest: attestation.buildLogDigest,
    builderIdentity: attestation.builderIdentity,
    keyId: attestation.keyId,
    notBefore: attestation.notBefore,
    expiresAt: attestation.expiresAt,
  });
}

export function bindLeanAttestationToProofManifest(
  attestation: LeanBuildAttestation,
  proofManifestRef: string,
): boolean {
  if (!isProofManifestRef(proofManifestRef)) {
    return false;
  }
  const expectedSuffix = attestation.proofManifestDigest as string;
  return proofManifestRef === `proof-manifest/${expectedSuffix}`;
}
