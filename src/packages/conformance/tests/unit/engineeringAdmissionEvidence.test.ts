import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest, createConformanceEvidenceVerifier } from "../../src/index.js";
import type {
  EngineeringAdmissionEvidenceBundle,
  EngineeringAdmissionEvidenceInputBundle,
} from "../../src/evidence/engineeringAdmissionEvidence.js";

describe("engineering admission evidence", () => {
  const from = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-001"), schemaDigest("a"));
  const to = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-002"), schemaDigest("b"));
  const subject = {
    admissionId: "adm-001",
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

  it("accepts complete digest-bound bundle with real sha256 facets", () => {
    const bundle: EngineeringAdmissionEvidenceBundle = {
      ...subject,
      dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
      resourceDigest: computeEvidenceDigest({ facet: "resource" }),
      sessionDigest: computeEvidenceDigest({ facet: "session" }),
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
      verifierVersion: "conformance/3.0-m2",
      evidenceRef: "evidence://four-view/1",
    };
    const verifier = createConformanceEvidenceVerifier();
    const result = verifier.verifyEngineeringAdmissionEvidence({ bundle, subject });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("rejects incomplete bundle", () => {
    const bundle: EngineeringAdmissionEvidenceBundle = {
      ...subject,
      dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
      resourceDigest: computeEvidenceDigest({ facet: "resource" }),
      sessionDigest: computeEvidenceDigest({ facet: "session" }),
      structureDigest: "not-a-digest" as never,
      verifierVersion: "conformance/3.0-m2",
      evidenceRef: "evidence://four-view/1",
    };
    const verifier = createConformanceEvidenceVerifier();
    const result = verifier.verifyEngineeringAdmissionEvidence({ bundle, subject });
    expect(result.ok).toBe(false);
  });

  it("rejects subject mismatch including expectedBindingGeneration", () => {
    const bundle: EngineeringAdmissionEvidenceBundle = {
      ...subject,
      expectedBindingGeneration: 0,
      dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
      resourceDigest: computeEvidenceDigest({ facet: "resource" }),
      sessionDigest: computeEvidenceDigest({ facet: "session" }),
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
      verifierVersion: "conformance/3.0-m2",
      evidenceRef: "evidence://four-view/1",
    };
    const verifier = createConformanceEvidenceVerifier();
    const result = verifier.verifyEngineeringAdmissionEvidence({
      bundle,
      subject: { ...subject, expectedBindingGeneration: 1 },
    });
    expect(result.ok).toBe(false);
  });

  it("supports legacy communicationDigest alias", () => {
    const sessionDigest = computeEvidenceDigest({ facet: "session" });
    const bundle = {
      ...subject,
      dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
      resourceDigest: computeEvidenceDigest({ facet: "resource" }),
      communicationDigest: sessionDigest,
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
      verifierVersion: "conformance/3.0-m2",
      evidenceRef: "evidence://four-view/1",
    } as EngineeringAdmissionEvidenceInputBundle;
    const verifier = createConformanceEvidenceVerifier();
    const result = verifier.verifyFourViewEvidence({ bundle, subject });
    expect(result.ok).toBe(true);
  });
});
