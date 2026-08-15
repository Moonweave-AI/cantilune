import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";
import {
  computeDagSemanticDigest,
  verifyDagSemanticEvidence,
} from "../../src/verifier/dagVerifier.js";

function admissionSubject(): AdmissionSubject {
  return {
    admissionId: "adm-dag",
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

describe("dagVerifier", () => {
  it("accepts complete digest-bound dag semantic evidence", () => {
    const subject = admissionSubject();
    const semantic = {
      configDigest: computeEvidenceDigest({ facet: "config" }),
      sccDigest: computeEvidenceDigest({ facet: "scc" }),
      rankDigest: computeEvidenceDigest({ facet: "rank" }),
      edgeCoverageDigest: computeEvidenceDigest({ facet: "edgeCoverage" }),
    };
    const digest = computeDagSemanticDigest({ semantic, subject });
    const violations = verifyDagSemanticEvidence({ semantic, digest, subject });
    expect(violations).toEqual([]);
  });

  it("rejects tampered projection digest", () => {
    const subject = admissionSubject();
    const semantic = {
      configDigest: computeEvidenceDigest({ facet: "config" }),
      sccDigest: computeEvidenceDigest({ facet: "scc" }),
      rankDigest: computeEvidenceDigest({ facet: "rank" }),
      edgeCoverageDigest: computeEvidenceDigest({ facet: "edgeCoverage" }),
    };
    const digest = computeEvidenceDigest({ tampered: true });
    const violations = verifyDagSemanticEvidence({ semantic, digest, subject });
    expect(violations.some((v) => v.code === "projection_invalid")).toBe(true);
  });

  it("rejects missing semantic digest fields", () => {
    const subject = admissionSubject();
    const semantic = {
      configDigest: computeEvidenceDigest({ facet: "config" }),
      sccDigest: "not-a-digest" as never,
      rankDigest: computeEvidenceDigest({ facet: "rank" }),
      edgeCoverageDigest: computeEvidenceDigest({ facet: "edgeCoverage" }),
    };
    const violations = verifyDagSemanticEvidence({
      semantic,
      digest: computeEvidenceDigest({ placeholder: true }),
      subject,
    });
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });
});
