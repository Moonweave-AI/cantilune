import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";
import { verifyPetriSemanticEvidence } from "../../src/verifier/petriVerifier.js";
import { verifyPiSemanticEvidence } from "../../src/verifier/piVerifier.js";
import { verifyMorphismSemanticEvidence } from "../../src/verifier/morphismVerifier.js";

function subject(): AdmissionSubject {
  return {
    admissionId: "adm-semantic",
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
}

describe("semantic projection negative branches", () => {
  const s = subject();
  const good = computeEvidenceDigest({ good: true });

  it("petri semantic rejects invalid digests", () => {
    expect(
      verifyPetriSemanticEvidence({
        semantic: {
          declarationDigest: "bad" as never,
          markingDigest: good,
          firingDigest: good,
          registryDigest: good,
        },
        digest: good,
        subject: s,
      }).length,
    ).toBeGreaterThan(0);
  });

  it("pi semantic rejects invalid digests", () => {
    expect(
      verifyPiSemanticEvidence({
        semantic: {
          nativeStepDigest: good,
          actionDigest: "bad" as never,
          freshnessDigest: good,
          registryDigest: good,
        },
        digest: good,
        subject: s,
      }).length,
    ).toBeGreaterThan(0);
  });

  it("morphism semantic rejects invalid digests", () => {
    expect(
      verifyMorphismSemanticEvidence({
        semantic: {
          mappingDigest: good,
          structureDigest: "bad" as never,
        },
        digest: good,
        subject: s,
      }).length,
    ).toBeGreaterThan(0);
  });
});
