import type { ConformanceTargetManifest } from "../manifest/conformanceTargetManifest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import { isSha256HexDigest } from "../canonical/evidenceDigest.js";
import type { ConformanceProfile } from "../foundation/conformanceProfile.js";
import { PROFILE_EVIDENCE_REQUIREMENTS } from "../foundation/profileEvidenceRequirements.js";

const VALID_PROFILES = new Set<string>(Object.keys(PROFILE_EVIDENCE_REQUIREMENTS));
const VALID_SCOPES = new Set(["generic", "reference", "product"]);

export function validateConformanceTargetManifest(
  manifest: ConformanceTargetManifest,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  if (manifest.manifestSchemaVersion !== 1) {
    violations.push(
      conformanceViolation(
        "missing_evidence",
        "manifestSchemaVersion must be 1",
        "manifestSchemaVersion",
      ),
    );
  }
  if (!VALID_SCOPES.has(manifest.claimScope)) {
    violations.push(conformanceViolation("scope_escalation", "invalid claimScope", "claimScope"));
  }
  if (!VALID_PROFILES.has(manifest.requestedProfile)) {
    violations.push(
      conformanceViolation("profile_insufficient", "unknown requestedProfile", "requestedProfile"),
    );
  }
  if (!isSha256HexDigest(manifest.evidenceRootDigest)) {
    violations.push(
      conformanceViolation(
        "digest_mismatch",
        "evidenceRootDigest must be sha256 hex",
        "evidenceRootDigest",
      ),
    );
  }
  if (manifest.ruleInventoryRef.length === 0) {
    violations.push(
      conformanceViolation("missing_evidence", "ruleInventoryRef required", "ruleInventoryRef"),
    );
  }
  if (manifest.proofManifestRef.length === 0) {
    violations.push(
      conformanceViolation("missing_evidence", "proofManifestRef required", "proofManifestRef"),
    );
  }
  if (manifest.policyRef.length === 0) {
    violations.push(conformanceViolation("missing_evidence", "policyRef required", "policyRef"));
  }
  if (manifest.theoryBaselineRef.length === 0) {
    violations.push(
      conformanceViolation("missing_evidence", "theoryBaselineRef required", "theoryBaselineRef"),
    );
  }
  if (manifest.ownerRef.length === 0) {
    violations.push(conformanceViolation("missing_evidence", "ownerRef required", "ownerRef"));
  }
  if (manifest.claimScope === "product") {
    if (manifest.packageName === undefined || manifest.packageVersion === undefined) {
      violations.push(
        conformanceViolation(
          "missing_evidence",
          "product scope requires packageName and packageVersion",
        ),
      );
    }
    if (manifest.artifactSubject === undefined) {
      violations.push(
        conformanceViolation("missing_evidence", "product scope requires artifactSubject"),
      );
    }
  }
  if (manifest.requiredReviewerRoles.length === 0) {
    violations.push(
      conformanceViolation("missing_evidence", "requiredReviewerRoles must be non-empty"),
    );
  }

  return violations;
}

export function requiredEvidenceClasses(profile: ConformanceProfile): readonly string[] {
  return PROFILE_EVIDENCE_REQUIREMENTS[profile];
}
