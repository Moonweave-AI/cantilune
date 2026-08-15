import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import type {
  EngineeringAdmissionEvidenceInputBundle,
  EngineeringAdmissionEvidenceSubject,
  VerifiedEngineeringAdmissionEvidence,
} from "../evidence/engineeringAdmissionEvidence.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import type { VerificationDecision } from "../foundation/verificationDecision.js";
import { isReviewedDecision, type ReviewedDecision } from "../lifecycle/sealedDecision.js";
import { reviewApproved } from "../lifecycle/reviewWorkflow.js";
import {
  verifyEngineeringAdmissionEvidence,
  ENGINEERING_ADMISSION_VERIFIER_BUILD,
} from "../verifier/engineeringAdmissionVerifier.js";
import type { TrustStore } from "../ports/trustStore.js";
import type { CryptoVerifier } from "../ports/cryptoVerifier.js";
import { verifyHumanReviewAttestation } from "../verifier/humanReviewAttestationVerifier.js";
import type { SignedHumanReviewAttestation } from "../certificate/signedHumanReviewAttestation.js";

export interface SealedAdmissionPrepareInput {
  readonly reviewedDecision: ReviewedDecision;
  readonly bundle: EngineeringAdmissionEvidenceInputBundle;
  readonly subject: EngineeringAdmissionEvidenceSubject;
  readonly signedAttestation: SignedHumanReviewAttestation;
}

export interface SealedAdmissionGateDeps {
  readonly trustStore: TrustStore;
  readonly crypto: CryptoVerifier;
  readonly requiredReviewerRoles: readonly string[];
  readonly now?: () => string;
}

/** Control-plane prepare gate — consumes sealed ReviewedDecision + re-verifies signed attestation. */
export async function validateSealedAdmissionPrepare(
  input: SealedAdmissionPrepareInput,
  deps: SealedAdmissionGateDeps,
): Promise<Result<VerifiedEngineeringAdmissionEvidence, ConformanceViolation[]>> {
  const now = deps.now ?? (() => new Date().toISOString());

  if (!isReviewedDecision(input.reviewedDecision)) {
    return err([
      conformanceViolation("admission_invalid", "prepare requires sealed ReviewedDecision"),
    ]);
  }
  const reviewed = input.reviewedDecision;
  if (!reviewApproved(reviewed)) {
    return err([
      conformanceViolation("admission_invalid", "human review decision is not approved"),
    ]);
  }

  const attestationViolations = await verifyHumanReviewAttestation(
    input.signedAttestation,
    reviewed.verified,
    {
      trustStore: deps.trustStore,
      crypto: deps.crypto,
      requiredRoles: deps.requiredReviewerRoles,
      now: now(),
      machineVerifierOwnerId: reviewed.verified.verifierBuild,
    },
  );
  if (attestationViolations.length > 0) {
    return err(attestationViolations);
  }

  const machine = verifyEngineeringAdmissionEvidence({
    bundle: input.bundle,
    subject: input.subject,
  });
  if (!machine.ok) {
    return err([conformanceViolation("admission_invalid", machine.error.message)]);
  }
  const decision = reviewed.verified.decision;
  if (decision.profile !== "engineeringAdmission") {
    return err([
      conformanceViolation(
        "profile_insufficient",
        `sealed decision profile ${decision.profile} is not engineeringAdmission`,
      ),
    ]);
  }
  if (decision.status.machine !== "verified" || decision.violations.length > 0) {
    return err([
      conformanceViolation("admission_invalid", "sealed machine decision is not verified"),
    ]);
  }
  const bundleDigest = machine.value.evidenceDigest as string;
  if (decision.evidenceRootDigest !== bundleDigest) {
    return err([
      conformanceViolation(
        "subject_mismatch",
        "sealed ReviewedDecision does not bind to supplied evidence bundle",
      ),
    ]);
  }
  if (reviewed.verified.verifierBuild !== ENGINEERING_ADMISSION_VERIFIER_BUILD) {
    return err([
      conformanceViolation(
        "trust_invalid",
        "sealed decision verifier build does not match current admission verifier",
      ),
    ]);
  }
  return ok(machine.value);
}

export function consumeSealedAdmissionDecision(
  reviewed: ReviewedDecision,
): Result<VerificationDecision, ConformanceViolation[]> {
  if (!isReviewedDecision(reviewed)) {
    return err([conformanceViolation("admission_invalid", "expected sealed ReviewedDecision")]);
  }
  if (!reviewApproved(reviewed)) {
    return err([
      conformanceViolation("admission_invalid", "release gate requires approved review"),
    ]);
  }
  return ok(reviewed.verified.decision);
}
