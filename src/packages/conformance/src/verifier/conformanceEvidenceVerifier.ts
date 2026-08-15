import type { Result } from "@cantilune/core";
import type {
  EngineeringAdmissionEvidenceSubject,
  EngineeringAdmissionEvidenceInputBundle,
  VerifiedEngineeringAdmissionEvidence,
} from "../evidence/engineeringAdmissionEvidence.js";
import type {
  FourViewEvidenceSubject,
  VerifiedFourViewEvidence,
} from "../evidence/fourViewEvidence.js";
import {
  verifyEngineeringAdmissionEvidence,
  type EngineeringAdmissionVerificationError,
} from "./engineeringAdmissionVerifier.js";

export type ConformanceVerificationError = EngineeringAdmissionVerificationError;

export interface ConformanceEvidenceVerifier {
  verifyEngineeringAdmissionEvidence(input: {
    readonly bundle: EngineeringAdmissionEvidenceInputBundle;
    readonly subject: EngineeringAdmissionEvidenceSubject;
  }): Result<VerifiedEngineeringAdmissionEvidence, ConformanceVerificationError>;

  /** @deprecated Use verifyEngineeringAdmissionEvidence */
  verifyFourViewEvidence(input: {
    readonly bundle: EngineeringAdmissionEvidenceInputBundle;
    readonly subject: FourViewEvidenceSubject;
  }): Result<VerifiedFourViewEvidence, ConformanceVerificationError>;
}

export function createConformanceEvidenceVerifier(): ConformanceEvidenceVerifier {
  return {
    verifyEngineeringAdmissionEvidence: verifyEngineeringAdmissionEvidence,
    verifyFourViewEvidence(input) {
      return verifyEngineeringAdmissionEvidence(input);
    },
  };
}

export type {
  EngineeringAdmissionEvidenceInputBundle as FourViewEvidenceBundle,
  VerifiedFourViewEvidence,
};
export type { EngineeringAdmissionEvidenceInputBundle } from "../evidence/engineeringAdmissionEvidence.js";
