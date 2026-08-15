import type { ContentDigest } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import {
  LEAN_BUILD_ATTESTATION_SCHEMA_VERSION,
  type LeanBuildAttestation,
} from "../../evidence/leanBuildAttestation.js";
import { isSha256HexDigest } from "../../canonical/evidenceDigest.js";

const GIT_SHA = /^[a-f0-9]{40}$/;

/** Test-only fixture parser — no network, no child_process. */
export interface LeanAttestationFixtureWire {
  readonly attestationRef?: string;
  readonly leanToolchainDigest?: string;
  readonly proofManifestDigest?: string;
  readonly buildLogDigest?: string;
  readonly gitCommit?: string;
  readonly gitTree?: string;
  readonly builderIdentity?: string;
  readonly keyId?: string;
  readonly signature?: string;
  readonly notBefore?: string;
  readonly expiresAt?: string;
}

export function parseLeanAttestationFixture(
  wire: LeanAttestationFixtureWire,
): LeanBuildAttestation | undefined {
  const leanToolchainDigest = wire.leanToolchainDigest;
  const proofManifestDigest = wire.proofManifestDigest;
  const buildLogDigest = wire.buildLogDigest;
  if (
    leanToolchainDigest === undefined ||
    proofManifestDigest === undefined ||
    buildLogDigest === undefined ||
    wire.gitCommit === undefined ||
    wire.gitTree === undefined ||
    wire.builderIdentity === undefined ||
    wire.keyId === undefined ||
    wire.signature === undefined ||
    wire.notBefore === undefined ||
    wire.expiresAt === undefined ||
    !isSha256HexDigest(leanToolchainDigest) ||
    !isSha256HexDigest(proofManifestDigest) ||
    !isSha256HexDigest(buildLogDigest) ||
    !GIT_SHA.test(wire.gitCommit) ||
    !GIT_SHA.test(wire.gitTree)
  ) {
    return undefined;
  }
  return {
    attestationSchemaVersion: LEAN_BUILD_ATTESTATION_SCHEMA_VERSION,
    attestationRef: wire.attestationRef ?? `lean-attestation/${proofManifestDigest}`,
    leanToolchainDigest: contentDigest(leanToolchainDigest) as ContentDigest,
    proofManifestDigest: contentDigest(proofManifestDigest) as ContentDigest,
    buildLogDigest: contentDigest(buildLogDigest) as ContentDigest,
    gitCommit: wire.gitCommit,
    gitTree: wire.gitTree,
    builderIdentity: wire.builderIdentity,
    keyId: wire.keyId,
    signature: wire.signature,
    notBefore: wire.notBefore,
    expiresAt: wire.expiresAt,
  };
}

export function parseLeanAttestationFixtureJson(json: string): LeanBuildAttestation | undefined {
  try {
    const wire = JSON.parse(json) as LeanAttestationFixtureWire;
    return parseLeanAttestationFixture(wire);
  } catch {
    return undefined;
  }
}
