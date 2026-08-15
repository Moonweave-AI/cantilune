import type { ConformanceProfile } from "../foundation/conformanceProfile.js";
import type { ConformanceStatusAxes } from "../foundation/conformanceStatus.js";
import type { CertificateId } from "../foundation/conformanceId.js";
import type { ArtifactSubject } from "../subject/artifactSubject.js";

export interface PackageConformanceCertificate {
  readonly certificateId: CertificateId;
  readonly certificateSchemaVersion: 1;
  readonly conformanceProfile: ConformanceProfile;
  readonly artifactSubject: ArtifactSubject;
  readonly ruleInventoryDigest: string;
  readonly evidenceRootDigest: string;
  readonly proofManifestDigest: string;
  readonly verifierBuild: string;
  readonly verifierArtifactDigest: string;
  readonly policyVersion: string;
  readonly policyDigest: string;
  readonly trustRootSetVersion: string;
  readonly revocationCheckpoint: string;
  readonly machineDecisionRef: string;
  readonly humanReviewAttestationRefs: readonly string[];
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly supersedes?: CertificateId;
  readonly status: ConformanceStatusAxes;
}

export interface MachineVerificationAttestation {
  readonly runId: string;
  readonly verifierBuild: string;
  readonly profile: ConformanceProfile;
  readonly subjectDigest: string;
  readonly evidenceRootDigest: string;
  readonly decisionDigest: string;
  readonly verifiedAt: string;
}

export interface HumanReviewAttestation {
  readonly reviewerId: string;
  readonly roles: readonly string[];
  readonly decision: "approved" | "rejected" | "conflict";
  readonly machineDecisionRef: string;
  readonly reviewedAt: string;
  readonly commentRef?: string;
}

export interface CertificateRevocationRecord {
  readonly certificateId: CertificateId;
  readonly revokedAt: string;
  readonly reason: string;
  readonly checkpoint: string;
}
