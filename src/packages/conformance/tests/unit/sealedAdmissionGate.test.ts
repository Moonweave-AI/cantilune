import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { validateSealedAdmissionPrepare } from "../../src/engine/sealedAdmissionGate.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { createMemoryCryptoVerifier } from "../../src/adapters/memory/index.js";
import { defaultTestReviewerTrustStore } from "../../src/testing/index.js";
import { buildReviewedEngineeringAdmissionForTest } from "../../src/testing/index.js";
import type { ReviewedDecision } from "../../src/lifecycle/sealedDecision.js";

describe("sealed admission gate", () => {
  const gateDeps = {
    trustStore: defaultTestReviewerTrustStore(),
    crypto: createMemoryCryptoVerifier(),
    requiredReviewerRoles: ["formal", "security"] as const,
  };

  const from = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-001"), schemaDigest("a"));
  const to = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-002"), schemaDigest("b"));
  const subject = {
    admissionId: "adm-sealed",
    activationDomainId: "default",
    fromSchemaRef: from,
    toSchemaRef: to,
    fromEpochId: "42",
    toEpochId: "43",
    fromEpochOrdinal: 1,
    toEpochOrdinal: 2,
    extensionPlanDigest: "plan-digest",
    expectedRuntimeHead: "snap-S0",
    expectedBindingGeneration: 1,
  };
  const bundle = {
    ...subject,
    dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
    resourceDigest: computeEvidenceDigest({ facet: "resource" }),
    sessionDigest: computeEvidenceDigest({ facet: "session" }),
    structureDigest: computeEvidenceDigest({ facet: "structure" }),
    verifierVersion: "conformance/3.0-m2",
    evidenceRef: "evidence://sealed/1",
  };

  it("accepts matching sealed ReviewedDecision with signed attestation", async () => {
    const reviewed = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) {
      return;
    }
    const gate = await validateSealedAdmissionPrepare(
      {
        reviewedDecision: reviewed.value.reviewedDecision,
        signedAttestation: reviewed.value.signedAttestation,
        bundle,
        subject,
      },
      gateDeps,
    );
    expect(gate.ok).toBe(true);
  });

  it("rejects plain object posing as ReviewedDecision", async () => {
    const reviewed = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) {
      return;
    }
    const gate = await validateSealedAdmissionPrepare(
      {
        reviewedDecision: { fake: true } as unknown as ReviewedDecision,
        signedAttestation: reviewed.value.signedAttestation,
        bundle,
        subject,
      },
      gateDeps,
    );
    expect(gate.ok).toBe(false);
  });

  it("rejects bundle digest mismatch against sealed decision", async () => {
    const reviewed = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) {
      return;
    }
    const gate = await validateSealedAdmissionPrepare(
      {
        reviewedDecision: reviewed.value.reviewedDecision,
        signedAttestation: reviewed.value.signedAttestation,
        bundle: {
          ...bundle,
          dependencyDigest: computeEvidenceDigest({ facet: "tampered" }),
        },
        subject,
      },
      gateDeps,
    );
    expect(gate.ok).toBe(false);
  });
});
