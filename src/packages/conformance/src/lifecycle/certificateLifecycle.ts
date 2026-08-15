import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import type { ConformanceViolation } from "../foundation/conformanceViolation.js";
import { conformanceViolation } from "../foundation/conformanceViolation.js";
import type { ConformanceTargetManifest } from "../manifest/conformanceTargetManifest.js";
import type { VerificationDecision } from "../foundation/verificationDecision.js";
import type { PackageConformanceCertificate } from "../certificate/packageConformanceCertificate.js";
import type { ReviewedDecision, VerifiedDecision } from "./sealedDecision.js";
import { isReviewedDecision, isVerifiedDecision } from "./sealedDecision.js";

export type CertificateLifecycleState =
  | "candidate"
  | "parsed"
  | "machineVerified"
  | "humanReviewed"
  | "issued"
  | "revoked"
  | "superseded"
  | "expired";

export interface CertificateLifecycleRecord {
  readonly certificateId: string;
  readonly state: CertificateLifecycleState;
  readonly updatedAt: string;
}

export function initialLifecycleState(): CertificateLifecycleState {
  return "candidate";
}

export function transitionParsed(
  manifest: ConformanceTargetManifest,
): Result<CertificateLifecycleRecord, ConformanceViolation[]> {
  if (manifest.manifestSchemaVersion !== 1) {
    return err([conformanceViolation("missing_evidence", "unsupported manifest schema version")]);
  }
  return ok({
    certificateId: manifest.evidenceRootDigest,
    state: "parsed",
    updatedAt: new Date().toISOString(),
  });
}

export function transitionMachineVerified(
  record: CertificateLifecycleRecord,
  verified: VerifiedDecision,
): Result<CertificateLifecycleRecord, ConformanceViolation[]> {
  if (record.state !== "parsed" && record.state !== "candidate") {
    return err([
      conformanceViolation("admission_invalid", `cannot verify from state ${record.state}`),
    ]);
  }
  if (!isVerifiedDecision(verified)) {
    return err([conformanceViolation("admission_invalid", "expected sealed VerifiedDecision")]);
  }
  return ok({
    certificateId: record.certificateId,
    state: "machineVerified",
    updatedAt: verified.verifiedAt,
  });
}

export function transitionHumanReviewed(
  record: CertificateLifecycleRecord,
  reviewed: ReviewedDecision,
): Result<CertificateLifecycleRecord, ConformanceViolation[]> {
  if (record.state !== "machineVerified") {
    return err([
      conformanceViolation("admission_invalid", "human review requires machineVerified state"),
    ]);
  }
  if (!isReviewedDecision(reviewed)) {
    return err([conformanceViolation("admission_invalid", "expected sealed ReviewedDecision")]);
  }
  return ok({
    certificateId: record.certificateId,
    state: "humanReviewed",
    updatedAt: reviewed.reviewedAt,
  });
}

export function transitionIssued(
  record: CertificateLifecycleRecord,
  certificate: PackageConformanceCertificate,
  reviewed: ReviewedDecision,
): Result<CertificateLifecycleRecord, ConformanceViolation[]> {
  if (record.state !== "humanReviewed") {
    return err([conformanceViolation("admission_invalid", "issue requires humanReviewed state")]);
  }
  if (reviewed.reviewDecision !== "approved") {
    return err([conformanceViolation("admission_invalid", "issue requires approved human review")]);
  }
  if (certificate.certificateId !== record.certificateId) {
    return err([conformanceViolation("admission_invalid", "certificate id mismatch")]);
  }
  return ok({
    certificateId: record.certificateId,
    state: "issued",
    updatedAt: certificate.issuedAt,
  });
}

export function applyVerificationDecision(
  record: CertificateLifecycleRecord,
  decision: VerificationDecision,
): Result<CertificateLifecycleRecord, ConformanceViolation[]> {
  if (decision.status.machine === "verified" && decision.violations.length === 0) {
    if (record.state === "parsed" || record.state === "candidate") {
      return ok({
        certificateId: record.certificateId,
        state: "machineVerified",
        updatedAt: decision.decidedAt,
      });
    }
  }
  if (decision.status.machine === "invalid") {
    return ok({
      certificateId: record.certificateId,
      state: "candidate",
      updatedAt: decision.decidedAt,
    });
  }
  return ok(record);
}
