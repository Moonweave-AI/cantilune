import { canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { ConformanceTargetManifest } from "../../src/manifest/conformanceTargetManifest.js";
import type { RuleInventory } from "../../src/manifest/ruleInventory.js";
import type { EvidenceStore } from "../../src/ports/evidenceStore.js";

export const FIXTURE_EVIDENCE_ROOT = computeEvidenceDigest({
  package: "@cantilune/conformance",
  version: "0.0.1",
}) as string;

const INVENTORY_ENTRIES = [
  { ruleId: "rule-native-1", ruleKind: "native", theoryRef: "Execution.lean" },
] as const;

export const FIXTURE_INVENTORY_DIGEST = computeEvidenceDigest({
  schema: 1,
  entries: INVENTORY_ENTRIES,
}) as string;

export function sampleManifest(
  overrides: Partial<ConformanceTargetManifest> = {},
): ConformanceTargetManifest {
  return {
    manifestSchemaVersion: 1,
    targetKind: "package",
    claimScope: "reference",
    packageName: "@cantilune/conformance",
    packageVersion: "0.0.1",
    requestedProfile: "engineeringAdmission",
    ruleInventoryRef: "inventory/conformance-m2",
    proofManifestRef:
      "proof-manifest/0000000000000000000000000000000000000000000000000000000000000000",
    evidenceRootDigest: FIXTURE_EVIDENCE_ROOT,
    policyRef: "policy://conformance-policy/m2@1" as ConformanceTargetManifest["policyRef"],
    theoryBaselineRef: "theory://baseline/m2@1" as ConformanceTargetManifest["theoryBaselineRef"],
    requiredReviewerRoles: ["formal", "security"],
    ownerRef: "owner/conformance",
    ...overrides,
  };
}

export function sampleInventory(overrides: Partial<RuleInventory> = {}): RuleInventory {
  return {
    inventorySchemaVersion: 1,
    inventoryDigest: FIXTURE_INVENTORY_DIGEST,
    entries: [...INVENTORY_ENTRIES],
    ...overrides,
  };
}

export const SAMPLE_OBSERVED = ["rule-native-1"] as const;

export const FIXTURE_ARTIFACT_DIGESTS = [FIXTURE_EVIDENCE_ROOT] as const;

export async function seedEvidenceArtifacts(store: EvidenceStore): Promise<void> {
  for (const digest of FIXTURE_ARTIFACT_DIGESTS) {
    const bytes = canonicalJsonBytes({ digest, fixture: true });
    const put = await store.put(digest, bytes);
    if (!put.ok) {
      throw new Error(`failed to seed evidence artifact ${digest}`);
    }
  }
}

export function sampleLeanAttestationWire(overrides: Record<string, string> = {}) {
  const proofManifestDigest = "1111111111111111111111111111111111111111111111111111111111111111";
  return {
    attestationSchemaVersion: 2,
    leanToolchainDigest: "2222222222222222222222222222222222222222222222222222222222222222",
    proofManifestDigest,
    buildLogDigest: "3333333333333333333333333333333333333333333333333333333333333333",
    attestationRef: `lean-attestation/${proofManifestDigest}`,
    gitCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    gitTree: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    builderIdentity: "lean-builder@test",
    keyId: "lean-builder-test",
    signature: "dGVzdA==",
    notBefore: "2020-01-01T00:00:00.000Z",
    expiresAt: "2099-12-31T23:59:59.999Z",
    ...overrides,
  };
}
