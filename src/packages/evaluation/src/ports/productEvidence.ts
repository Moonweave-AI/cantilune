import type { ContentDigest } from "@cantilune/core";
import type { EvaluationResult } from "../foundation/evaluationResult.js";
import type { CertifiedTraceEvidence } from "../collection/certifiedTraceEvidence.js";
import type { CertificateValidity } from "../foundation/evaluationStatus.js";

export interface ConformanceCertificateResolver {
  resolve(certificateRef: string): Promise<EvaluationResult<ResolvedCertificate>>;
  checkValidity(certificateRef: string): Promise<CertificateValidity>;
  checkRevocation(certificateRef: string, checkpoint: string): Promise<boolean>;
}

export interface ResolvedCertificate {
  readonly certificateDigest: ContentDigest;
  readonly artifactSubjectDigest: ContentDigest;
  readonly verifierBuild: string;
  readonly policyVersion: string;
  readonly evidenceRootDigest: ContentDigest;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly status: CertificateValidity;
  /** ADR-0011 A54 — revocation checkpoint bound at resolve time. */
  readonly revocationCheckpoint?: string;
}

export interface ArtifactResolver {
  resolve(artifactRef: string): Promise<EvaluationResult<Uint8Array>>;
  resolveDigest(artifactRef: string): Promise<EvaluationResult<ContentDigest>>;
}

export interface ObservationReader {
  readObservations(
    runRef: string,
    fromEpoch: string,
    toEpoch: string,
  ): Promise<EvaluationResult<readonly unknown[]>>;
}

export interface RuntimeReplayOracle {
  replay(snapshotRef: string, events: readonly unknown[]): Promise<EvaluationResult<ReplayResult>>;
}

export interface ReplayResult {
  readonly terminalSnapshotRef: string;
  readonly stepCount: number;
  readonly resultDigest: ContentDigest;
}

export interface AdmissionEvidenceReader {
  readAdmissionEvidence(runRef: string): Promise<EvaluationResult<readonly unknown[]>>;
}

export interface CommunicationEvidenceReader {
  readCommunicationEvidence(runRef: string): Promise<EvaluationResult<readonly unknown[]>>;
}

export interface TraceRedactor {
  redact(
    evidence: CertifiedTraceEvidence,
    policy: string,
  ): Promise<EvaluationResult<CertifiedTraceEvidence>>;
}
