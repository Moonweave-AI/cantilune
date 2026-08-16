import { createPrivateKey, sign } from "node:crypto";
import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import {
  verifyEngineeringAdmissionEvidence,
  ENGINEERING_ADMISSION_VERIFIER_BUILD,
} from "../verifier/engineeringAdmissionVerifier.js";
import { computeEvidenceDigest } from "../canonical/evidenceDigest.js";
import { canonicalJsonBytes } from "../canonical/canonicalEncoding.js";
import { initialConformanceStatus } from "../foundation/conformanceStatus.js";
import { verificationRunId } from "../foundation/conformanceId.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import type { ReviewedDecision } from "../lifecycle/sealedDecision.js";
import { sealVerifiedDecision } from "../lifecycle/sealedDecision.js";
import { submitHumanReview } from "../lifecycle/reviewWorkflow.js";
import type {
  EngineeringAdmissionEvidenceInputBundle,
  EngineeringAdmissionEvidenceSubject,
} from "../evidence/engineeringAdmissionEvidence.js";
import type { VerificationDecision } from "../foundation/verificationDecision.js";
import type { SignedHumanReviewAttestation } from "../certificate/signedHumanReviewAttestation.js";
import { domainSeparatedPayload } from "../canonical/signatureDomain.js";
import { TEST_REVIEWER_KEY_ID } from "./testReviewerTrustStore.js";

/** TEST ONLY — private key must never ship in production authority paths. */
export const TEST_REVIEWER_PRIVATE_KEY = Uint8Array.from(
  Buffer.from("2a1fbdb5ff81908d7db49c0f1deb680553d1697261663e78bbd1870ce1861161", "hex"),
);

function signAttestationPayload(payload: Uint8Array): string {
  const key = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(TEST_REVIEWER_PRIVATE_KEY),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const message = domainSeparatedPayload("attestation", payload);
  return sign(null, Buffer.from(message), key).toString("base64");
}

function buildSignedAttestation(input: {
  readonly reviewerId: string;
  readonly roles: readonly string[];
  readonly machineDecisionRef: string;
  readonly reviewedAt: string;
  readonly decision: "approved" | "rejected" | "conflict";
}): SignedHumanReviewAttestation {
  const attestationDigest = computeEvidenceDigest({
    reviewerId: input.reviewerId,
    roles: input.roles,
    decision: input.decision,
    machineDecisionRef: input.machineDecisionRef,
    reviewedAt: input.reviewedAt,
  }) as string;
  const unsigned = {
    reviewerId: input.reviewerId,
    roles: input.roles,
    decision: input.decision,
    machineDecisionRef: input.machineDecisionRef,
    reviewedAt: input.reviewedAt,
    attestationDigest,
    keyId: TEST_REVIEWER_KEY_ID,
  };
  const signature = signAttestationPayload(canonicalJsonBytes(unsigned));
  return { ...unsigned, signature };
}

/** Test harness only — simulates signed human review; NOT production authority. */
export function buildReviewedEngineeringAdmissionForTest(input: {
  readonly bundle: EngineeringAdmissionEvidenceInputBundle;
  readonly subject: EngineeringAdmissionEvidenceSubject;
  readonly reviewerId?: string;
  readonly reviewedAt?: string;
}): Result<
  {
    readonly reviewedDecision: ReviewedDecision;
    readonly signedAttestation: SignedHumanReviewAttestation;
  },
  ConformanceViolation[]
> {
  const machine = verifyEngineeringAdmissionEvidence({
    bundle: input.bundle,
    subject: input.subject,
  });
  if (!machine.ok) {
    return err([conformanceViolation("admission_invalid", machine.error.message)]);
  }
  const now = input.reviewedAt ?? new Date().toISOString();
  const decision: VerificationDecision = {
    runId: verificationRunId(`eadm-test-${now}`),
    profile: "engineeringAdmission",
    status: {
      ...initialConformanceStatus(),
      machine: "verified",
      humanReview: "pending",
      release: "notEvaluated",
    },
    violations: [],
    evidenceRootDigest: machine.value.evidenceDigest as string,
    decidedAt: now,
  };
  const verified = sealVerifiedDecision({
    decision,
    verifiedAt: now,
    verifierBuild: ENGINEERING_ADMISSION_VERIFIER_BUILD,
  });
  const signedAttestation = buildSignedAttestation({
    reviewerId: input.reviewerId ?? "conformance-test-reviewer",
    roles: ["formal", "security"],
    decision: "approved",
    machineDecisionRef: machine.value.evidenceDigest as string,
    reviewedAt: now,
  });
  const reviewed = submitHumanReview({ verified, attestation: signedAttestation });
  if (!reviewed.ok) {
    return reviewed;
  }
  return ok({ reviewedDecision: reviewed.value, signedAttestation });
}
