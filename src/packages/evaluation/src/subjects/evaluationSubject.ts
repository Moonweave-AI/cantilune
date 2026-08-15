import type { ContentDigest } from "@cantilune/core";
import type { ArtifactSubject } from "@cantilune/conformance";
import type { EvaluationSubjectId } from "../foundation/evaluationIds.js";
import type { CertificateValidity } from "../foundation/evaluationStatus.js";

export interface CandidateSubject {
  readonly subjectId: EvaluationSubjectId;
  readonly subjectKind: "candidate";
  readonly packageConformanceCertificateRef: string;
  readonly certificateDigest: ContentDigest;
  readonly artifactSubject: ArtifactSubject;
  readonly packageConfigurationRef: string;
  readonly schemaBindingRef: string;
  readonly policyRef: string;
  readonly runtimeConfigRef: string;
  readonly controlPlaneConfigRef: string;
  readonly commsConfigRef: string;
  readonly adapterBuild: string;
  readonly adapterDigest: ContentDigest;
  readonly certificateValidity: CertificateValidity;
  readonly revocationCheckpoint: string;
  readonly subjectDigest: ContentDigest;
}

export interface BaselineSubject {
  readonly subjectId: EvaluationSubjectId;
  readonly subjectKind: "baseline";
  readonly productName: string;
  readonly productVersion: string;
  readonly commitOrServiceVersion: string;
  readonly artifactDigest: ContentDigest | undefined;
  readonly adapterVersion: string;
  readonly adapterDigest: ContentDigest;
  readonly modelConfig: string;
  readonly providerConfig: string;
  readonly toolConfig: string;
  readonly promptConfig: string;
  readonly policyConfig: string;
  readonly capabilityManifest: readonly string[];
  readonly licenseOrTos: string;
  readonly versionVerifiedAt: string;
  readonly knownLimitations: readonly string[];
  readonly provenanceUnavailable: boolean;
  readonly subjectDigest: ContentDigest;
}

export type EvaluationSubject = CandidateSubject | BaselineSubject;

export function isCandidate(subject: EvaluationSubject): subject is CandidateSubject {
  return subject.subjectKind === "candidate";
}

export function isBaseline(subject: EvaluationSubject): subject is BaselineSubject {
  return subject.subjectKind === "baseline";
}

export function isCandidateCertificateValid(subject: CandidateSubject): boolean {
  return subject.certificateValidity === "valid";
}
