/**
 * @deprecated Import from `./engineeringAdmissionEvidence.js` instead.
 * Kept for backward compatibility with control-plane admission harness.
 */
export {
  type EngineeringAdmissionEvidenceBundle as FourViewEvidenceBundle,
  type EngineeringAdmissionEvidenceSubject as FourViewEvidenceSubject,
  type VerifiedEngineeringAdmissionEvidence as VerifiedFourViewEvidence,
  engineeringAdmissionEvidenceComplete as fourViewEvidenceComplete,
  admissionSubjectsMatch as subjectsMatch,
  normalizeEngineeringBundle,
} from "./engineeringAdmissionEvidence.js";
