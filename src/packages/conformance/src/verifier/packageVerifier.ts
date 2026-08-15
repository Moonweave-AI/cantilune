import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import type { ConformanceTargetManifest } from "../manifest/conformanceTargetManifest.js";
import type { RuleInventory } from "../manifest/ruleInventory.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import type { EvidenceStore } from "../ports/evidenceStore.js";
import type { RevocationStore } from "../ports/revocationStore.js";
import type { TrustStore } from "../ports/trustStore.js";
import {
  policyAllowsProfile,
  policyAllowsScope,
  type VerificationPolicy,
} from "../policy/verificationPolicy.js";
import { verifyRuleInventoryCompleteness } from "./inventoryVerifier.js";
import { validateConformanceTargetManifest } from "./manifestVerifier.js";
import { validateRuleInventory } from "../manifest/ruleInventory.js";

const MAX_RULE_COUNT = 10_000;

export interface PackageVerificationInput {
  readonly manifest: ConformanceTargetManifest;
  readonly inventory: RuleInventory;
  readonly observedRuleIds: readonly string[];
  readonly evidenceArtifactDigests: readonly string[];
}

export interface PackageVerificationDeps {
  readonly evidenceStore: EvidenceStore;
  readonly trustStore: TrustStore;
  readonly revocationStore: RevocationStore;
  readonly policy: VerificationPolicy;
}

async function verifyEvidenceArtifactsExist(
  store: EvidenceStore,
  digests: readonly string[],
): Promise<ConformanceViolation[]> {
  const violations: ConformanceViolation[] = [];
  for (const digest of digests) {
    if (!isSha256HexDigest(digest)) {
      violations.push(conformanceViolation("digest_mismatch", `invalid artifact digest ${digest}`));
      continue;
    }
    const has = await store.has(digest);
    if (!has) {
      violations.push(
        conformanceViolation(
          "missing_evidence",
          `evidence artifact not found in store: ${digest}`,
          digest,
        ),
      );
    }
  }
  return violations;
}

export async function verifyPackageEvidence(
  input: PackageVerificationInput,
  deps: PackageVerificationDeps,
): Promise<ConformanceViolation[]> {
  const violations: ConformanceViolation[] = [];

  violations.push(...validateConformanceTargetManifest(input.manifest));

  if (input.inventory.inventorySchemaVersion !== 1) {
    violations.push(
      conformanceViolation("inventory_incomplete", "inventorySchemaVersion must be 1"),
    );
  }
  if (!isSha256HexDigest(input.inventory.inventoryDigest)) {
    violations.push(conformanceViolation("digest_mismatch", "inventoryDigest must be sha256 hex"));
  }
  const computedInventoryDigest = computeEvidenceDigest({
    schema: input.inventory.inventorySchemaVersion,
    entries: input.inventory.entries,
  }) as string;
  if (input.inventory.inventoryDigest !== computedInventoryDigest) {
    violations.push(
      conformanceViolation("digest_mismatch", "inventory digest does not match entries"),
    );
  }
  for (const message of validateRuleInventory(input.inventory)) {
    violations.push(conformanceViolation("inventory_duplicate", message));
  }
  if (input.inventory.entries.length === 0) {
    violations.push(
      conformanceViolation("inventory_incomplete", "rule inventory must not be empty"),
    );
  }
  if (input.inventory.entries.length > MAX_RULE_COUNT) {
    violations.push(
      conformanceViolation("inventory_incomplete", "rule inventory exceeds maxRuleCount"),
    );
  }

  violations.push(...verifyRuleInventoryCompleteness(input.inventory, input.observedRuleIds));

  if (!policyAllowsScope(deps.policy, input.manifest.claimScope)) {
    violations.push(conformanceViolation("scope_escalation", "claim scope not allowed by policy"));
  }
  if (!policyAllowsProfile(deps.policy, input.manifest.requestedProfile)) {
    violations.push(
      conformanceViolation("profile_insufficient", "requested profile exceeds policy minimum"),
    );
  }

  if (input.evidenceArtifactDigests.length === 0) {
    violations.push(
      conformanceViolation("missing_evidence", "at least one evidence artifact digest required"),
    );
  }
  violations.push(
    ...(await verifyEvidenceArtifactsExist(deps.evidenceStore, input.evidenceArtifactDigests)),
  );

  if (await deps.revocationStore.isRevoked(input.manifest.evidenceRootDigest)) {
    violations.push(conformanceViolation("revoked", "manifest evidence root is revoked"));
  }

  if (
    deps.trustStore.getRoots("conformance/verify").length === 0 &&
    input.manifest.claimScope === "product"
  ) {
    violations.push(
      conformanceViolation("trust_invalid", "product scope requires configured trust roots"),
    );
  }

  return violations;
}
