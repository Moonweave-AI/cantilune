/**
 * Generate ConformanceTargetManifest fixtures for all 14 production packages.
 * Consumable by verifyPackage — digests are deterministic from package identity.
 * These are engineering evidence scaffolds; they are NOT signed release certificates.
 */
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGES = [
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

function sha256Hex(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export interface PackageEvidenceBundle {
  readonly packageName: string;
  readonly manifest: {
    readonly manifestSchemaVersion: 1;
    readonly targetKind: "package";
    readonly claimScope: "reference";
    readonly packageName: string;
    readonly packageVersion: string;
    readonly requestedProfile: "engineeringAdmission";
    readonly ruleInventoryRef: string;
    readonly proofManifestRef: string;
    readonly evidenceRootDigest: string;
    readonly policyRef: string;
    readonly theoryBaselineRef: string;
    readonly requiredReviewerRoles: readonly string[];
    readonly ownerRef: string;
  };
  readonly inventory: {
    readonly inventorySchemaVersion: 1;
    readonly inventoryDigest: string;
    readonly entries: readonly {
      readonly ruleId: string;
      readonly ruleKind: string;
      readonly theoryRef: string;
    }[];
  };
  readonly observedRuleIds: readonly string[];
  readonly evidenceArtifactDigests: readonly string[];
}

export function buildPackageEvidenceBundle(pkg: string): PackageEvidenceBundle {
  const packageName = `@cantilune/${pkg}`;
  const entries = [
    {
      ruleId: `rule-${pkg}-native-1`,
      ruleKind: "native",
      theoryRef: `${pkg}.lean`,
    },
  ];
  const inventoryDigest = sha256Hex({ schema: 1, entries });
  const evidenceRootDigest = sha256Hex({ package: packageName, version: "0.0.1" });
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
      policyRef: "policy://conformance-policy/m2@1",
      theoryBaselineRef: "theory://baseline/m2@1",
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
  return PACKAGES.map(buildPackageEvidenceBundle);
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "evidence", "packages");

if (process.argv[1] && process.argv[1].includes("generatePackageEvidenceManifests")) {
  mkdirSync(outDir, { recursive: true });
  for (const bundle of allPackageEvidenceBundles()) {
    const slug = bundle.packageName.replace("@cantilune/", "");
    writeFileSync(join(outDir, `${slug}.manifest.json`), JSON.stringify(bundle.manifest, null, 2));
    writeFileSync(
      join(outDir, `${slug}.inventory.json`),
      JSON.stringify(bundle.inventory, null, 2),
    );
    writeFileSync(
      join(outDir, `${slug}.observed.json`),
      JSON.stringify(bundle.observedRuleIds, null, 2),
    );
    writeFileSync(
      join(outDir, `${slug}.artifacts.json`),
      JSON.stringify(bundle.evidenceArtifactDigests, null, 2),
    );
  }
  writeFileSync(
    join(outDir, "index.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Engineering evidence scaffolds for verifyPackage. NOT signed release certificates.",
        packages: PACKAGES.map((p) => `@cantilune/${p}`),
      },
      null,
      2,
    ),
  );
}
