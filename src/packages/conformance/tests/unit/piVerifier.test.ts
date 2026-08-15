import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";
import {
  computePiSemanticDigest,
  verifyPiSemanticEvidence,
} from "../../src/verifier/piVerifier.js";

function admissionSubject(): AdmissionSubject {
  return {
    admissionId: "adm-pi",
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

describe("piVerifier", () => {
  it("accepts complete digest-bound pi semantic evidence", () => {
    const subject = admissionSubject();
    const semantic = {
      nativeStepDigest: computeEvidenceDigest({ facet: "nativeStep" }),
      actionDigest: computeEvidenceDigest({ facet: "action" }),
      freshnessDigest: computeEvidenceDigest({ facet: "freshness" }),
      registryDigest: computeEvidenceDigest({ facet: "registry" }),
    };
    const digest = computePiSemanticDigest({ semantic, subject });
    expect(verifyPiSemanticEvidence({ semantic, digest, subject })).toEqual([]);
  });

  it("rejects tampered projection digest", () => {
    const subject = admissionSubject();
    const semantic = {
      nativeStepDigest: computeEvidenceDigest({ facet: "nativeStep" }),
      actionDigest: computeEvidenceDigest({ facet: "action" }),
      freshnessDigest: computeEvidenceDigest({ facet: "freshness" }),
      registryDigest: computeEvidenceDigest({ facet: "registry" }),
    };
    const violations = verifyPiSemanticEvidence({
      semantic,
      digest: computeEvidenceDigest({ tampered: true }),
      subject,
    });
    expect(violations.some((v) => v.code === "projection_invalid")).toBe(true);
  });
});
