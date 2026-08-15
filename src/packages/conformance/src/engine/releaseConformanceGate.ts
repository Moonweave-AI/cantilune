import type { VerificationDecision } from "../foundation/verificationDecision.js";
import type { ReviewedDecision } from "../lifecycle/sealedDecision.js";
import { isReviewedDecision } from "../lifecycle/sealedDecision.js";
import { reviewApproved } from "../lifecycle/reviewWorkflow.js";
import type { PackageConformanceCertificate } from "../certificate/packageConformanceCertificate.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import { isSha256HexDigest } from "../canonical/evidenceDigest.js";

function certificateViolations(certificate: PackageConformanceCertificate): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (certificate.certificateSchemaVersion !== 1) {
    violations.push(
      conformanceViolation("admission_invalid", "certificate schema version must be 1"),
    );
  }
  if (!isSha256HexDigest(certificate.evidenceRootDigest)) {
    violations.push(
      conformanceViolation("digest_mismatch", "certificate evidenceRootDigest invalid"),
    );
  }
  if (certificate.status.release === "revoked" || certificate.status.release === "expired") {
    violations.push(
      conformanceViolation("revoked", "certificate release status is revoked or expired"),
    );
  }
  return violations;
}

export interface ReleaseGateInput {
  readonly reviewed: ReviewedDecision;
  readonly certificate: PackageConformanceCertificate;
  readonly now: string;
}

export function validateReleaseGateInput(input: ReleaseGateInput): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (!isReviewedDecision(input.reviewed)) {
    violations.push(
      conformanceViolation("admission_invalid", "release gate requires sealed ReviewedDecision"),
    );
    return violations;
  }
  if (!reviewApproved(input.reviewed)) {
    violations.push(
      conformanceViolation("admission_invalid", "release gate requires approved human review"),
    );
  }
  const decision = input.reviewed.verified.decision;
  if (decision.status.machine !== "verified" || decision.violations.length > 0) {
    violations.push(
      conformanceViolation("admission_invalid", "release gate requires verified machine decision"),
    );
  }
  if (input.certificate.evidenceRootDigest !== decision.evidenceRootDigest) {
    violations.push(
      conformanceViolation(
        "subject_mismatch",
        "certificate does not bind to reviewed machine decision",
      ),
    );
  }
  if (input.now < input.certificate.notBefore || input.now > input.certificate.expiresAt) {
    violations.push(conformanceViolation("revoked", "certificate outside validity window"));
  }
  violations.push(...certificateViolations(input.certificate));
  return violations;
}

export function evaluateReleaseConformanceGate(
  input: ReleaseGateInput,
): "blocked" | "conditional" | "accepted" {
  const violations = validateReleaseGateInput(input);
  if (violations.length > 0) {
    return "blocked";
  }
  if (
    input.certificate.status.release === "accepted" &&
    input.reviewed.reviewDecision === "approved"
  ) {
    return "accepted";
  }
  return "conditional";
}

/** @deprecated Bare VerificationDecision is not sufficient for release — use ReleaseGateInput. */
export function evaluateReleaseConformanceGateLegacy(
  decision: VerificationDecision,
): "blocked" | "conditional" | "accepted" {
  if (decision.status.release === "accepted" && decision.status.humanReview === "approved") {
    return "accepted";
  }
  if (
    decision.status.release === "blocked" ||
    decision.status.release === "revoked" ||
    decision.status.release === "expired"
  ) {
    return "blocked";
  }
  return "conditional";
}
