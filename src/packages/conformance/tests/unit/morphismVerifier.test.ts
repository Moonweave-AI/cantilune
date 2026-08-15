import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";
import {
  computeMorphismSemanticDigest,
  verifyMorphismSemanticEvidence,
} from "../../src/verifier/morphismVerifier.js";

function admissionSubject(): AdmissionSubject {
  return {
    admissionId: "adm-morphism",
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
    extensionPlanDigest: "plan-digest",
    expectedRuntimeHead: "snap-S0",
    expectedBindingGeneration: 1,
  };
}

describe("morphismVerifier", () => {
  it("accepts complete digest-bound morphism semantic evidence", () => {
    const subject = admissionSubject();
    const semantic = {
      mappingDigest: computeEvidenceDigest({ facet: "mapping" }),
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
    };
    const digest = computeMorphismSemanticDigest({ semantic, subject });
    expect(verifyMorphismSemanticEvidence({ semantic, digest, subject })).toEqual([]);
  });

  it("rejects tampered projection digest", () => {
    const subject = admissionSubject();
    const semantic = {
      mappingDigest: computeEvidenceDigest({ facet: "mapping" }),
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
    };
    const violations = verifyMorphismSemanticEvidence({
      semantic,
      digest: computeEvidenceDigest({ tampered: true }),
      subject,
    });
    expect(violations.some((v) => v.code === "projection_invalid")).toBe(true);
  });
});
