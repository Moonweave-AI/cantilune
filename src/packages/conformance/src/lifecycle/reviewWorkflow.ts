import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import type { ConformanceViolation } from "../foundation/conformanceViolation.js";
import { conformanceViolation } from "../foundation/conformanceViolation.js";
import type { HumanReviewAttestation } from "../certificate/packageConformanceCertificate.js";
import {
  isVerifiedDecision,
  sealReviewedDecision,
  type ReviewedDecision,
  type VerifiedDecision,
} from "./sealedDecision.js";
import { isSignedHumanReviewAttestation } from "../certificate/signedHumanReviewAttestation.js";

export interface HumanReviewInput {
  readonly verified: VerifiedDecision;
  readonly attestation: HumanReviewAttestation;
}

export function submitHumanReview(
  input: HumanReviewInput,
): Result<ReviewedDecision, ConformanceViolation[]> {
  if (!isVerifiedDecision(input.verified)) {
    return err([
      conformanceViolation("admission_invalid", "human review requires a sealed VerifiedDecision"),
    ]);
  }
  if (!isSignedHumanReviewAttestation(input.attestation)) {
    return err([
      conformanceViolation(
        "admission_invalid",
        "production human review requires signed attestation with keyId and signature",
      ),
    ]);
  }
  if (input.verified.decision.status.machine !== "verified") {
    return err([
      conformanceViolation("admission_invalid", "cannot approve without machine verification"),
    ]);
  }
  if (input.attestation.decision === "approved" && input.verified.decision.violations.length > 0) {
    return err([
      conformanceViolation("admission_invalid", "cannot approve decision with violations"),
    ]);
  }
  if (
    input.attestation.machineDecisionRef !== (input.verified.decision.evidenceRootDigest as string)
  ) {
    return err([
      conformanceViolation(
        "admission_invalid",
        "human review attestation does not bind to machine decision",
      ),
    ]);
  }
  const reviewed = sealReviewedDecision({
    verified: input.verified,
    reviewerId: input.attestation.reviewerId,
    reviewDecision: input.attestation.decision,
    reviewedAt: input.attestation.reviewedAt,
  });
  return ok(reviewed);
}

export function reviewApproved(reviewed: ReviewedDecision): boolean {
  return reviewed.reviewDecision === "approved";
}
