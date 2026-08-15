import { describe, expect, it } from "vitest";
import {
  initialLifecycleState,
  transitionHumanReviewed,
  transitionIssued,
  transitionMachineVerified,
  transitionParsed,
  applyVerificationDecision,
} from "../../src/lifecycle/certificateLifecycle.js";
import { sealReviewedDecision, sealVerifiedDecision } from "../../src/lifecycle/sealedDecision.js";
import { submitHumanReview, reviewApproved } from "../../src/lifecycle/reviewWorkflow.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";
import type { VerificationDecision } from "../../src/foundation/verificationDecision.js";
import type { ConformanceTargetManifest } from "../../src/manifest/conformanceTargetManifest.js";
import type { PackageConformanceCertificate } from "../../src/certificate/packageConformanceCertificate.js";
import { buildReviewedEngineeringAdmissionForTest } from "../../src/testing/index.js";
import { verificationRunId } from "../../src/foundation/conformanceId.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";

import { sampleManifest } from "../support/conformanceFixtures.js";

function manifest(): ConformanceTargetManifest {
  return sampleManifest();
}

function verified(): VerificationDecision {
  return {
    runId: verificationRunId("run-lifecycle"),
    profile: "engineeringAdmission",
    status: { ...initialConformanceStatus(), machine: "verified" },
    violations: [],
    evidenceRootDigest: computeEvidenceDigest({ lifecycle: true }),
    decidedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("certificateLifecycle transitions", () => {
  it("walks parsed → machineVerified → humanReviewed → issued", () => {
    const parsed = transitionParsed(manifest());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const sealed = sealVerifiedDecision({
      decision: verified(),
      verifiedAt: "2026-01-01T00:00:00.000Z",
      verifierBuild: "test",
    });
    const machine = transitionMachineVerified(parsed.value, sealed);
    expect(machine.ok).toBe(true);
    if (!machine.ok) {
      return;
    }
    const reviewed = sealReviewedDecision({
      verified: sealed,
      reviewerId: "reviewer-1",
      reviewDecision: "approved",
      reviewedAt: "2026-01-02T00:00:00.000Z",
    });
    const human = transitionHumanReviewed(machine.value, reviewed);
    expect(human.ok).toBe(true);
    if (!human.ok) {
      return;
    }
    const certificate = {
      certificateId: parsed.value.certificateId,
      issuedAt: "2026-01-03T00:00:00.000Z",
    } as PackageConformanceCertificate;
    const issued = transitionIssued(human.value, certificate, reviewed);
    expect(issued.ok).toBe(true);
    expect(initialLifecycleState()).toBe("candidate");
  });

  it("applyVerificationDecision leaves issued state unchanged", () => {
    const parsed = transitionParsed(manifest());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const issued = {
      certificateId: parsed.value.certificateId,
      state: "issued" as const,
      updatedAt: "t",
    };
    const result = applyVerificationDecision(issued, verified());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe("issued");
    }
  });
});

describe("reviewWorkflow", () => {
  it("accepts signed attestation from testing harness", () => {
    const subject = {
      admissionId: "adm-review",
      activationDomainId: "default",
      fromSchemaRef: schemaRef(
        schemaId("default-v1"),
        schemaRevisionId("rev-001"),
        schemaDigest("a"),
      ),
      toSchemaRef: schemaRef(
        schemaId("default-v1"),
        schemaRevisionId("rev-002"),
        schemaDigest("b"),
      ),
      fromEpochId: "42",
      toEpochId: "43",
      fromEpochOrdinal: 1,
      toEpochOrdinal: 2,
      extensionPlanDigest: "plan",
      expectedRuntimeHead: "snap-S0",
      expectedBindingGeneration: 1,
    };
    const bundle = {
      ...subject,
      dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
      resourceDigest: computeEvidenceDigest({ facet: "resource" }),
      sessionDigest: computeEvidenceDigest({ facet: "session" }),
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
      verifierVersion: "conformance/test",
      evidenceRef: "evidence://review/1",
    };
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const reviewed = submitHumanReview({
      verified: built.value.reviewedDecision.verified,
      attestation: built.value.signedAttestation,
    });
    expect(reviewed.ok).toBe(true);
    if (reviewed.ok) {
      expect(reviewApproved(reviewed.value)).toBe(true);
    }
  });
});
