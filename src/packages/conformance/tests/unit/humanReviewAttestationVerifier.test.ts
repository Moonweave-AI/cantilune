import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { verifyHumanReviewAttestation } from "../../src/verifier/humanReviewAttestationVerifier.js";
import {
  createMemoryCryptoVerifier,
  defaultTestReviewerTrustStore,
} from "../../src/adapters/memory/index.js";
import { buildReviewedEngineeringAdmissionForTest } from "../../src/testing/index.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";

describe("humanReviewAttestationVerifier", () => {
  const subject = {
    admissionId: "adm-hr",
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
    dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
    resourceDigest: computeEvidenceDigest({ facet: "resource" }),
    sessionDigest: computeEvidenceDigest({ facet: "session" }),
    structureDigest: computeEvidenceDigest({ facet: "structure" }),
    verifierVersion: "conformance/test",
    evidenceRef: "evidence://hr/1",
  };

  it("accepts harness signed attestation", async () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const violations = await verifyHumanReviewAttestation(
      built.value.signedAttestation,
      built.value.reviewedDecision.verified,
      {
        trustStore: defaultTestReviewerTrustStore(),
        crypto: createMemoryCryptoVerifier(),
        requiredRoles: ["formal", "security"],
        now: "2026-01-01T00:00:00.000Z",
      },
    );
    expect(violations).toEqual([]);
  });

  it("rejects COI when reviewer equals machine owner", async () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const violations = await verifyHumanReviewAttestation(
      built.value.signedAttestation,
      built.value.reviewedDecision.verified,
      {
        trustStore: defaultTestReviewerTrustStore(),
        crypto: createMemoryCryptoVerifier(),
        requiredRoles: ["formal", "security"],
        now: "2026-01-01T00:00:00.000Z",
        machineVerifierOwnerId: built.value.signedAttestation.reviewerId,
      },
    );
    expect(violations.some((v) => v.message.includes("COI"))).toBe(true);
  });
});
