import type { ClaimScope, ConformanceProfile } from "../foundation/conformanceProfile.js";
import type { ArtifactSubject } from "../subject/artifactSubject.js";
import type { PolicyRef, TheoryBaselineRef } from "../foundation/conformanceId.js";

export interface ConformanceTargetManifest {
  readonly manifestSchemaVersion: 1;
  readonly targetKind: "package" | "rule" | "admission" | "trajectory";
  readonly claimScope: ClaimScope;
  readonly packageName?: string;
  readonly packageVersion?: string;
  readonly artifactSubject?: ArtifactSubject;
  readonly requestedProfile: ConformanceProfile;
  readonly ruleInventoryRef: string;
  readonly proofManifestRef: string;
  readonly evidenceRootDigest: string;
  readonly policyRef: PolicyRef;
  readonly theoryBaselineRef: TheoryBaselineRef;
  readonly requiredReviewerRoles: readonly string[];
  readonly ownerRef: string;
}

export interface FormalProofManifest {
  readonly proofManifestSchemaVersion: 1;
  readonly theoryBaselineRef: TheoryBaselineRef;
  readonly obligationRefs: readonly string[];
  readonly leanBuildAttestationRef?: string;
  readonly claimScope: ClaimScope;
}
