import { computeEvidenceDigest } from "../canonical/evidenceDigest.js";
import type { ConformanceTargetManifest } from "../manifest/conformanceTargetManifest.js";
import type { RuleInventory } from "../manifest/ruleInventory.js";

export const PRODUCTION_PACKAGES = [
  "core",
  "runtime",
  "observability",
  "control-plane",
  "evaluation",
  "comms",
  "conformance",
  "content",
  "syscall",
  "boot",
  "adapter",
  "tools",
  "cli",
  "petri",
] as const;

export type ProductionPackageSlug = (typeof PRODUCTION_PACKAGES)[number];

export interface PackageEvidenceBundle {
  readonly packageName: string;
  readonly manifest: ConformanceTargetManifest;
  readonly inventory: RuleInventory;
  readonly observedRuleIds: readonly string[];
  readonly evidenceArtifactDigests: readonly string[];
}

/**
 * Evidence manifests for all 14 production packages, consumable by verifyPackage.
 * These are engineering scaffolds — NOT signed release certificates.
 */
export function buildPackageEvidenceBundle(pkg: ProductionPackageSlug): PackageEvidenceBundle {
  const packageName = `@cantilune/${pkg}`;
  const entries = [
    {
      ruleId: `rule-${pkg}-native-1`,
      ruleKind: "native" as const,
      theoryRef: `${pkg}.lean`,
    },
  ];
  const inventoryDigest = computeEvidenceDigest({ schema: 1, entries }) as string;
  const evidenceRootDigest = computeEvidenceDigest({
    package: packageName,
    version: "0.0.1",
  }) as string;

  return {
    packageName,
    manifest: {
      manifestSchemaVersion: 1,
      targetKind: "package",
      claimScope: "reference",
      packageName,
      packageVersion: "0.0.1",
      requestedProfile: "engineeringAdmission",
      ruleInventoryRef: `inventory/${pkg}-m2`,
      proofManifestRef: `proof-manifest/${"0".repeat(64)}`,
      evidenceRootDigest,
      policyRef: "policy://conformance-policy/m2@1" as ConformanceTargetManifest["policyRef"],
      theoryBaselineRef:
        "theory://baseline/m2@1" as ConformanceTargetManifest["theoryBaselineRef"],
      requiredReviewerRoles: ["formal", "security"],
      ownerRef: `owner/${pkg}`,
    },
    inventory: {
      inventorySchemaVersion: 1,
      inventoryDigest,
      entries,
    },
    observedRuleIds: entries.map((e) => e.ruleId),
    evidenceArtifactDigests: [evidenceRootDigest],
  };
}

export function allPackageEvidenceBundles(): readonly PackageEvidenceBundle[] {
  return PRODUCTION_PACKAGES.map(buildPackageEvidenceBundle);
}
