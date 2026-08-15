export {
  createConformanceEvidenceVerifier,
  type ConformanceEvidenceVerifier,
  type ConformanceVerificationError,
  type FourViewEvidenceBundle,
  type VerifiedFourViewEvidence,
} from "./verifier/conformanceEvidenceVerifier.js";

export {
  verifyEngineeringAdmissionEvidence,
  ENGINEERING_ADMISSION_VERIFIER_BUILD,
} from "./verifier/engineeringAdmissionVerifier.js";

export {
  createConformanceEngine,
  type ConformanceEngine,
  type ConformanceEngineDeps,
} from "./engine/conformanceEngine.js";

export { evaluateAdmissionConformanceGate } from "./engine/admissionConformanceGate.js";
export {
  evaluateReleaseConformanceGate,
  evaluateReleaseConformanceGateLegacy,
  validateReleaseGateInput,
  type ReleaseGateInput,
} from "./engine/releaseConformanceGate.js";

export {
  fourViewEvidenceComplete,
  engineeringAdmissionEvidenceComplete,
  admissionSubjectsMatch,
  normalizeEngineeringBundle,
  type EngineeringAdmissionEvidenceBundle,
  type EngineeringAdmissionEvidenceInputBundle,
  type VerifiedEngineeringAdmissionEvidence,
  type FourViewEvidenceSubject,
} from "./evidence/engineeringAdmissionEvidence.js";

export {
  formalFourProjectionComplete,
  type FormalFourProjectionCertificate,
  type FormalFourProjectionEvidenceBundle,
} from "./evidence/formalFourProjectionCertificate.js";

export type {
  ConformanceTargetManifest,
  FormalProofManifest,
} from "./manifest/conformanceTargetManifest.js";
export type { RuleInventory, RuleInventoryEntry } from "./manifest/ruleInventory.js";
export { validateRuleInventory } from "./manifest/ruleInventory.js";
export { verifyRuleInventoryCompleteness } from "./verifier/inventoryVerifier.js";

export type { VerificationDecision } from "./foundation/verificationDecision.js";
export { decisionAccepted } from "./foundation/verificationDecision.js";
export type {
  ConformanceViolation,
  ConformanceViolationCode,
} from "./foundation/conformanceViolation.js";
export { conformanceViolation } from "./foundation/conformanceViolation.js";
export type {
  ConformanceStatusAxes,
  TheoryEvidenceStatus,
  MachineVerificationStatus,
  HumanReviewStatus,
  ReleaseDecisionStatus,
} from "./foundation/conformanceStatus.js";
export { initialConformanceStatus } from "./foundation/conformanceStatus.js";
export type { ConformanceProfile, ClaimScope } from "./foundation/conformanceProfile.js";
export { profilePermits, PROFILE_RANK } from "./foundation/conformanceProfile.js";

export type {
  ConformanceId,
  CertificateId,
  VerificationRunId,
  EvidenceArtifactRef,
  TheoryBaselineRef,
  PolicyRef,
} from "./foundation/conformanceId.js";

export type { VersionedEvidenceEnvelope } from "./foundation/versionedEvidenceEnvelope.js";
export {
  computeEvidenceDigest,
  isSha256HexDigest,
  assertSha256HexDigest,
} from "./canonical/evidenceDigest.js";
export { canonicalizeJson, canonicalJsonBytes } from "./canonical/canonicalEncoding.js";

export type { ArtifactSubject } from "./subject/artifactSubject.js";
export type {
  AdmissionSubject,
  RuleOccurrenceSubject,
  TrajectorySubject,
} from "./subject/admissionSubject.js";

export type {
  PackageConformanceCertificate,
  MachineVerificationAttestation,
  HumanReviewAttestation,
  CertificateRevocationRecord,
} from "./certificate/packageConformanceCertificate.js";

export {
  DEFAULT_VERIFICATION_POLICY,
  policyAllowsScope,
  policyAllowsProfile,
  type VerificationPolicy,
} from "./policy/verificationPolicy.js";

export { verifyEvidenceEnvelope } from "./verifier/envelopeVerifier.js";

export {
  validateSealedAdmissionPrepare,
  consumeSealedAdmissionDecision,
  type SealedAdmissionPrepareInput,
  type SealedAdmissionGateDeps,
} from "./engine/sealedAdmissionGate.js";
export type { SignedHumanReviewAttestation } from "./certificate/signedHumanReviewAttestation.js";
export { isSignedHumanReviewAttestation } from "./certificate/signedHumanReviewAttestation.js";
export { profileSatisfiesRequirements } from "./foundation/profileEvidenceRequirements.js";
export type { EvidenceClass } from "./foundation/profileEvidenceRequirements.js";
export {
  isReviewedDecision,
  isVerifiedDecision,
  type ReviewedDecision,
  type VerifiedDecision,
} from "./lifecycle/sealedDecision.js";
export {
  verifyDpoReplayWithPort,
  type DpoReplayExecutionEvidence,
} from "./verifier/dpoReplayVerifier.js";
export type { DpoReplayPort } from "./ports/dpoReplayPort.js";
