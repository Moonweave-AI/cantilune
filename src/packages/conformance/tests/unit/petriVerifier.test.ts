import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";
import {
  computePetriSemanticDigest,
  verifyPetriSemanticEvidence,
} from "../../src/verifier/petriVerifier.js";

function admissionSubject(): AdmissionSubject {
  return {
    admissionId: "adm-petri",
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

describe("petriVerifier", () => {
  it("accepts complete digest-bound petri semantic evidence", () => {
    const subject = admissionSubject();
    const semantic = {
      declarationDigest: computeEvidenceDigest({ facet: "declaration" }),
      markingDigest: computeEvidenceDigest({ facet: "marking" }),
      firingDigest: computeEvidenceDigest({ facet: "firing" }),
      registryDigest: computeEvidenceDigest({ facet: "registry" }),
    };
    const digest = computePetriSemanticDigest({ semantic, subject });
    expect(verifyPetriSemanticEvidence({ semantic, digest, subject })).toEqual([]);
  });

  it("rejects tampered projection digest", () => {
    const subject = admissionSubject();
    const semantic = {
      declarationDigest: computeEvidenceDigest({ facet: "declaration" }),
      markingDigest: computeEvidenceDigest({ facet: "marking" }),
      firingDigest: computeEvidenceDigest({ facet: "firing" }),
      registryDigest: computeEvidenceDigest({ facet: "registry" }),
    };
    const violations = verifyPetriSemanticEvidence({
      semantic,
      digest: computeEvidenceDigest({ tampered: true }),
      subject,
    });
    expect(violations.some((v) => v.code === "projection_invalid")).toBe(true);
  });
});
