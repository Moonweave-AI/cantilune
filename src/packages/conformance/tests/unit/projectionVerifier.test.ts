import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";
import type { FormalFourProjectionEvidenceBundle } from "../../src/evidence/formalFourProjectionCertificate.js";
import { computeDagSemanticDigest } from "../../src/verifier/dagVerifier.js";
import { computeMorphismSemanticDigest } from "../../src/verifier/morphismVerifier.js";
import { computePetriSemanticDigest } from "../../src/verifier/petriVerifier.js";
import { computePiSemanticDigest } from "../../src/verifier/piVerifier.js";
import { verifyFourProjections } from "../../src/verifier/projectionVerifier.js";

function admissionSubject(): AdmissionSubject {
  return {
    admissionId: "adm-proj",
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

function semantics(subject: AdmissionSubject) {
  const dagSemantic = {
    configDigest: computeEvidenceDigest({ facet: "config" }),
    sccDigest: computeEvidenceDigest({ facet: "scc" }),
    rankDigest: computeEvidenceDigest({ facet: "rank" }),
    edgeCoverageDigest: computeEvidenceDigest({ facet: "edgeCoverage" }),
  };
  const petriSemantic = {
    declarationDigest: computeEvidenceDigest({ facet: "declaration" }),
    markingDigest: computeEvidenceDigest({ facet: "marking" }),
    firingDigest: computeEvidenceDigest({ facet: "firing" }),
    registryDigest: computeEvidenceDigest({ facet: "registry" }),
  };
  const piSemantic = {
    nativeStepDigest: computeEvidenceDigest({ facet: "nativeStep" }),
    actionDigest: computeEvidenceDigest({ facet: "action" }),
    freshnessDigest: computeEvidenceDigest({ facet: "freshness" }),
    registryDigest: computeEvidenceDigest({ facet: "registry" }),
  };
  const morphismSemantic = {
    mappingDigest: computeEvidenceDigest({ facet: "mapping" }),
    structureDigest: computeEvidenceDigest({ facet: "structure" }),
  };
  return {
    dag: {
      semantic: dagSemantic,
      digest: computeDagSemanticDigest({ semantic: dagSemantic, subject }),
    },
    petri: {
      semantic: petriSemantic,
      digest: computePetriSemanticDigest({ semantic: petriSemantic, subject }),
    },
    pi: {
      semantic: piSemantic,
      digest: computePiSemanticDigest({ semantic: piSemantic, subject }),
    },
    morphism: {
      semantic: morphismSemantic,
      digest: computeMorphismSemanticDigest({ semantic: morphismSemantic, subject }),
    },
  };
}

describe("projectionVerifier", () => {
  it("accepts four projections bound to bundle digests", () => {
    const subject = admissionSubject();
    const bundleSemantics = semantics(subject);
    const bundle: FormalFourProjectionEvidenceBundle = {
      subject,
      dagDigest: bundleSemantics.dag.digest,
      petriDigest: bundleSemantics.petri.digest,
      piDigest: bundleSemantics.pi.digest,
      morphismDigest: bundleSemantics.morphism.digest,
      sharedExecutionDigest: computeEvidenceDigest({ facet: "sharedExecution" }),
      evidenceRef: "evidence://four-projection/1",
    };
    expect(
      verifyFourProjections({
        subject,
        semantics: bundleSemantics,
        bundle,
      }),
    ).toEqual([]);
  });

  it("rejects bundle digest mismatch against semantic projection", () => {
    const subject = admissionSubject();
    const bundleSemantics = semantics(subject);
    const bundle: FormalFourProjectionEvidenceBundle = {
      subject,
      dagDigest: computeEvidenceDigest({ tampered: true }),
      petriDigest: bundleSemantics.petri.digest,
      piDigest: bundleSemantics.pi.digest,
      morphismDigest: bundleSemantics.morphism.digest,
      sharedExecutionDigest: computeEvidenceDigest({ facet: "sharedExecution" }),
      evidenceRef: "evidence://four-projection/1",
    };
    const violations = verifyFourProjections({
      subject,
      semantics: bundleSemantics,
      bundle,
    });
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });

  it("rejects bundle subject mismatch and incomplete bundle", () => {
    const subject = admissionSubject();
    const bundleSemantics = semantics(subject);
    const bundle: FormalFourProjectionEvidenceBundle = {
      subject: { ...subject, admissionId: "other" },
      dagDigest: bundleSemantics.dag.digest,
      petriDigest: bundleSemantics.petri.digest,
      piDigest: bundleSemantics.pi.digest,
      morphismDigest: bundleSemantics.morphism.digest,
      sharedExecutionDigest: computeEvidenceDigest({ facet: "sharedExecution" }),
      evidenceRef: "evidence://four-projection/1",
    };
    expect(
      verifyFourProjections({ subject, semantics: bundleSemantics, bundle }).some(
        (v) => v.code === "subject_mismatch",
      ),
    ).toBe(true);
    expect(
      verifyFourProjections({
        subject,
        semantics: bundleSemantics,
        bundle: { ...bundle, sharedExecutionDigest: "bad" as never },
      }).some((v) => v.code === "projection_invalid"),
    ).toBe(true);
    expect(verifyFourProjections({ subject, semantics: bundleSemantics })).toEqual([]);
  });
});
