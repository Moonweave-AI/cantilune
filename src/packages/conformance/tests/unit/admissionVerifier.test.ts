import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";
import {
  computeCrossEpochChainDigest,
  computeFormalAdmissionDigest,
  computeOperationalProjectionDigest,
  verifyCrossEpochAdmission,
  verifyOperationalProjectionEvidence,
} from "../../src/verifier/admissionVerifier.js";

function admissionSubject(): AdmissionSubject {
  return {
    admissionId: "adm-admission",
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

describe("admissionVerifier", () => {
  it("accepts cross-epoch admission with digest binding", () => {
    const subject = admissionSubject();
    const extensionDigest = computeEvidenceDigest({ facet: "extension" });
    const admission = {
      extensionDigest,
      admissionDigest: computeFormalAdmissionDigest({
        admission: {
          admissionDigest: computeEvidenceDigest({ placeholder: true }),
          extensionDigest,
        },
        subject,
      }),
    };
    const epochChain = {
      fromEpochId: subject.fromEpochId,
      toEpochId: subject.toEpochId,
      chainDigest: computeCrossEpochChainDigest({
        epochChain: {
          fromEpochId: subject.fromEpochId,
          toEpochId: subject.toEpochId,
          chainDigest: computeEvidenceDigest({ placeholder: true }),
        },
        subject,
      }),
    };
    expect(verifyCrossEpochAdmission({ admission, epochChain, subject })).toEqual([]);
  });

  it("rejects non-monotonic epoch ordinals", () => {
    const subject = { ...admissionSubject(), toEpochOrdinal: 1 };
    const admission = {
      admissionDigest: computeEvidenceDigest({ placeholder: true }),
      extensionDigest: computeEvidenceDigest({ facet: "extension" }),
    };
    const violations = verifyCrossEpochAdmission({
      admission,
      epochChain: {
        fromEpochId: subject.fromEpochId,
        toEpochId: subject.toEpochId,
        chainDigest: computeEvidenceDigest({ placeholder: true }),
      },
      subject,
    });
    expect(violations.some((v) => v.code === "admission_invalid")).toBe(true);
  });

  it("accepts operational projection evidence digest", () => {
    const evidence = {
      projectionKind: "operational" as const,
      soundDigest: computeEvidenceDigest({ facet: "sound" }),
      reflectionDigest: computeEvidenceDigest({ facet: "reflection" }),
    };
    const evidenceDigest = computeOperationalProjectionDigest(evidence);
    expect(verifyOperationalProjectionEvidence({ evidence, evidenceDigest })).toEqual([]);
  });

  it("rejects invalid operational projection evidence", () => {
    const evidence = {
      projectionKind: "dag" as never,
      soundDigest: computeEvidenceDigest({ facet: "sound" }),
      reflectionDigest: computeEvidenceDigest({ facet: "reflection" }),
    };
    expect(
      verifyOperationalProjectionEvidence({
        evidence,
        evidenceDigest: computeOperationalProjectionDigest({
          projectionKind: "operational",
          soundDigest: evidence.soundDigest,
          reflectionDigest: evidence.reflectionDigest,
        }),
      }).some((v) => v.code === "projection_invalid"),
    ).toBe(true);
    expect(
      verifyOperationalProjectionEvidence({
        evidence: {
          projectionKind: "operational",
          soundDigest: "bad" as never,
          reflectionDigest: computeEvidenceDigest({ facet: "reflection" }),
        },
        evidenceDigest: computeEvidenceDigest({ bad: true }),
      }).length,
    ).toBeGreaterThan(0);
  });
});
