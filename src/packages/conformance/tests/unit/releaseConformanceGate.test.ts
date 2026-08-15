import { describe, expect, it } from "vitest";
import {
  evaluateReleaseConformanceGate,
  validateReleaseGateInput,
} from "../../src/engine/releaseConformanceGate.js";
import { buildReviewedEngineeringAdmissionForTest } from "../../src/testing/index.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import type { PackageConformanceCertificate } from "../../src/certificate/packageConformanceCertificate.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";

describe("releaseConformanceGate", () => {
  const subject = {
    admissionId: "adm-release",
    activationDomainId: "default",
    fromSchemaRef: schemaRef(
      schemaId("default-v1"),
      schemaRevisionId("rev-001"),
      schemaDigest("a"),
    ),
    toSchemaRef: schemaRef(schemaId("default-v1"), schemaRevisionId("rev-002"), schemaDigest("b")),
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
    dependencyDigest: computeEvidenceDigest({ dependency: true }),
    resourceDigest: computeEvidenceDigest({ resource: true }),
    sessionDigest: computeEvidenceDigest({ session: true }),
    structureDigest: computeEvidenceDigest({ structure: true }),
    verifierVersion: "conformance/test",
    evidenceRef: "evidence://release/1",
  };

  it("blocks forged ReviewedDecision objects", () => {
    const violations = validateReleaseGateInput({
      reviewed: { fake: true } as never,
      certificate: {} as PackageConformanceCertificate,
      now: "2026-01-01T00:00:00.000Z",
    });
    expect(violations.some((v) => v.message.includes("sealed ReviewedDecision"))).toBe(true);
    expect(
      evaluateReleaseConformanceGate({
        reviewed: { fake: true } as never,
        certificate: {} as PackageConformanceCertificate,
        now: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("blocked");
  });

  it("accepts harness reviewed decision bound to certificate digest", () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const root = built.value.reviewedDecision.verified.decision.evidenceRootDigest;
    const certificate = {
      certificateId: "cert-release-001",
      certificateSchemaVersion: 1,
      evidenceRootDigest: root,
      notBefore: "2020-01-01T00:00:00.000Z",
      expiresAt: "2099-12-31T23:59:59.999Z",
      status: { ...initialConformanceStatus(), release: "accepted", humanReview: "approved" },
    } as PackageConformanceCertificate;
    const gate = evaluateReleaseConformanceGate({
      reviewed: built.value.reviewedDecision,
      certificate,
      now: "2026-01-01T00:00:00.000Z",
    });
    expect(gate).toBe("accepted");
  });

  it("blocks certificate outside validity window", () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const root = built.value.reviewedDecision.verified.decision.evidenceRootDigest;
    const certificate = {
      certificateId: "cert-release-001",
      certificateSchemaVersion: 1,
      evidenceRootDigest: root,
      notBefore: "2020-01-01T00:00:00.000Z",
      expiresAt: "2020-06-01T00:00:00.000Z",
      status: { ...initialConformanceStatus(), release: "accepted", humanReview: "approved" },
    } as PackageConformanceCertificate;
    const violations = validateReleaseGateInput({
      reviewed: built.value.reviewedDecision,
      certificate,
      now: "2026-01-01T00:00:00.000Z",
    });
    expect(violations.some((v) => v.code === "revoked")).toBe(true);
  });
});
