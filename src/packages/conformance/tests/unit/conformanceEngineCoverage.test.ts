import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef, snapshotRef } from "@cantilune/core";
import {
  createMemoryConformanceEngine,
  createMemoryEvidenceStore,
  createMemoryTrustStore,
  createMemoryRevocationStore,
  createMemoryVerificationCache,
  createNoopAuditSink,
} from "../../src/adapters/memory/index.js";
import { createConformanceEngine } from "../../src/engine/conformanceEngine.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import {
  computeCrossEpochChainDigest,
  computeFormalAdmissionDigest,
  computeOperationalProjectionDigest,
} from "../../src/verifier/admissionVerifier.js";
import { computeProbabilityEvidenceDigest } from "../../src/verifier/probabilityVerifier.js";
import { computeDagSemanticDigest } from "../../src/verifier/dagVerifier.js";
import { computePetriSemanticDigest } from "../../src/verifier/petriVerifier.js";
import { computePiSemanticDigest } from "../../src/verifier/piVerifier.js";
import { computeMorphismSemanticDigest } from "../../src/verifier/morphismVerifier.js";
import {
  FIXTURE_ARTIFACT_DIGESTS,
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
  seedEvidenceArtifacts,
} from "../support/conformanceFixtures.js";
import { computeTrajectoryEvidenceDigest } from "../../src/verifier/trajectoryVerifier.js";
import { verificationRunId } from "../../src/foundation/conformanceId.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";

describe("conformanceEngine coverage paths", () => {
  const engine = createMemoryConformanceEngine({ audit: createNoopAuditSink() });

  it("inspectCandidate rejects disallowed scope", () => {
    const result = engine.inspectCandidate(sampleManifest({ claimScope: "product" }));
    expect(result.ok).toBe(false);
  });

  it("verifyDpoReplay fails when port is not configured", async () => {
    const result = await engine.verifyDpoReplay({
      evidence: {
        recipeRef: "recipe-chain:sha256:" + "a".repeat(64),
        deterministic: true,
        replayDigest: computeEvidenceDigest({ replay: true }),
        fromSnapshotRef: snapshotRef("snap-S0"),
        toSnapshotRef: snapshotRef("snap-S1"),
        changes: [],
      },
      subject: {
        artifactSubjectRef: "artifact://1",
        signatureVersion: "sig-v1",
        epochId: "42",
        ruleId: "rule-1",
        occurrenceId: "occ-1",
        beforeSnapshotRef: "snap-S0",
        eventRef: "evt-1",
        afterSnapshotRef: "snap-S1",
        replayRecipeRef: "recipe-chain:sha256:" + "a".repeat(64),
      },
    });
    expect(result.ok).toBe(false);
  });

  it("exercises projection, trajectory, and gate helper methods", async () => {
    const subject = {
      admissionId: "adm-engine",
      activationDomainId: "default",
      fromSchemaRef: schemaRef(
        schemaId("default-v1"),
        schemaRevisionId("rev-001"),
        schemaDigest("a"),
      ),
      toSchemaRef: schemaRef(
        schemaId("default-v1"),
        schemaRevisionId("rev-002"),
        schemaDigest("b"),
      ),
      fromEpochId: "42",
      toEpochId: "43",
      fromEpochOrdinal: 1,
      toEpochOrdinal: 2,
      extensionPlanDigest: "plan-digest",
      expectedRuntimeHead: "snap-S0",
      expectedBindingGeneration: 1,
    };
    const dagSemantic = {
      configDigest: computeEvidenceDigest({ facet: "config" }),
      sccDigest: computeEvidenceDigest({ facet: "scc" }),
      rankDigest: computeEvidenceDigest({ facet: "rank" }),
      edgeCoverageDigest: computeEvidenceDigest({ facet: "edgeCoverage" }),
    };
    const semantics = {
      dag: {
        semantic: dagSemantic,
        digest: computeDagSemanticDigest({ semantic: dagSemantic, subject }),
      },
      petri: {
        semantic: {
          declarationDigest: computeEvidenceDigest({ facet: "declaration" }),
          markingDigest: computeEvidenceDigest({ facet: "marking" }),
          firingDigest: computeEvidenceDigest({ facet: "firing" }),
          registryDigest: computeEvidenceDigest({ facet: "registry" }),
        },
        digest: computeEvidenceDigest({ petri: true }),
      },
      pi: {
        semantic: {
          nativeStepDigest: computeEvidenceDigest({ facet: "nativeStep" }),
          actionDigest: computeEvidenceDigest({ facet: "action" }),
          freshnessDigest: computeEvidenceDigest({ facet: "freshness" }),
          registryDigest: computeEvidenceDigest({ facet: "registry" }),
        },
        digest: computeEvidenceDigest({ pi: true }),
      },
      morphism: {
        semantic: {
          mappingDigest: computeEvidenceDigest({ facet: "mapping" }),
          structureDigest: computeEvidenceDigest({ facet: "structure" }),
        },
        digest: computeEvidenceDigest({ morphism: true }),
      },
    };
    semantics.petri.digest = computePetriSemanticDigest({
      semantic: semantics.petri.semantic,
      subject,
    });
    semantics.pi.digest = computePiSemanticDigest({ semantic: semantics.pi.semantic, subject });
    semantics.morphism.digest = computeMorphismSemanticDigest({
      semantic: semantics.morphism.semantic,
      subject,
    });

    const bundle = {
      subject,
      dagDigest: semantics.dag.digest,
      petriDigest: semantics.petri.digest,
      piDigest: semantics.pi.digest,
      morphismDigest: semantics.morphism.digest,
      sharedExecutionDigest: computeEvidenceDigest({ shared: true }),
      evidenceRef: "evidence://engine/1",
    };

    expect(engine.verifyFourProjection({ bundle, semantics }).ok).toBe(true);
    expect(
      engine.verifyOperationalProjection({
        evidence: {
          projectionKind: "operational",
          soundDigest: computeEvidenceDigest({ sound: true }),
          reflectionDigest: computeEvidenceDigest({ reflection: true }),
        },
        evidenceDigest: computeOperationalProjectionDigest({
          projectionKind: "operational",
          soundDigest: computeEvidenceDigest({ sound: true }),
          reflectionDigest: computeEvidenceDigest({ reflection: true }),
        }),
      }).ok,
    ).toBe(true);

    const trajectorySubject = {
      productSubjectRef: "product://subject/1",
      epochChainRef: "epoch-chain://1",
      initialStateRef: "state://initial",
      terminalStateRef: "state://terminal",
      selectedOccurrenceRef: "occurrence://selected",
      selectedIndex: 0,
      trajectoryDigest: computeEvidenceDigest({ facet: "trajectory" }) as string,
      kernelDigest: computeEvidenceDigest({ facet: "kernel" }) as string,
    };
    const trajectoryEvidence = {
      trajectoryDigest: trajectorySubject.trajectoryDigest as never,
      terminalDigest: computeEvidenceDigest({ facet: "terminal" }),
    };
    const trajectoryDigest = computeTrajectoryEvidenceDigest({
      evidence: trajectoryEvidence,
      subject: trajectorySubject,
    });
    expect(
      engine.verifyTrajectory({
        subject: trajectorySubject,
        evidence: trajectoryEvidence,
        evidenceDigest: trajectoryDigest,
      }).ok,
    ).toBe(true);

    expect(
      engine.verifyTrajectory({
        subject: { ...trajectorySubject, productSubjectRef: "" },
        evidence: trajectoryEvidence,
        evidenceDigest: trajectoryDigest,
      }).ok,
    ).toBe(false);

    const admission = {
      extensionDigest: computeEvidenceDigest({ extension: true }),
      admissionDigest: computeEvidenceDigest({ admission: true }),
    };
    admission.admissionDigest = computeFormalAdmissionDigest({ admission, subject });
    const epochChain = {
      fromEpochId: subject.fromEpochId,
      toEpochId: subject.toEpochId,
      chainDigest: computeEvidenceDigest({ chain: true }),
    };
    epochChain.chainDigest = computeCrossEpochChainDigest({ epochChain, subject });
    expect(engine.verifyAdmission({ subject, admission }).ok).toBe(true);
    expect(engine.verifyEpochChain({ subject, epochChain }).ok).toBe(true);

    const engineeringBundle = {
      ...subject,
      dependencyDigest: computeEvidenceDigest({ dependency: true }),
      resourceDigest: computeEvidenceDigest({ resource: true }),
      sessionDigest: computeEvidenceDigest({ session: true }),
      structureDigest: computeEvidenceDigest({ structure: true }),
      verifierVersion: "conformance/test",
      evidenceRef: "evidence://engine/adm",
    };
    expect(engine.verifyEngineeringAdmission({ bundle: engineeringBundle, subject }).ok).toBe(true);
    expect(engine.verifyFourViewEvidence({ bundle: engineeringBundle, subject }).ok).toBe(true);

    const decision = {
      runId: verificationRunId("run-explain"),
      profile: "engineeringAdmission" as const,
      status: { ...initialConformanceStatus(), machine: "verified" as const },
      violations: [],
      evidenceRootDigest: computeEvidenceDigest({ explain: true }),
      decidedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(engine.explainDecision(decision)).toContain("profile=engineeringAdmission");
    expect(
      engine.explainDecision({
        ...decision,
        violations: [{ code: "digest_mismatch", message: "tampered" }],
      }),
    ).toContain("digest_mismatch");
    expect(engine.evaluateAdmissionGate(decision)).toBe("conditional");
    expect(engine.evaluateReleaseGate(decision)).toBe("conditional");
    expect(
      engine.evaluateReleaseGate({
        ...decision,
        status: {
          ...initialConformanceStatus(),
          machine: "verified",
          humanReview: "approved",
          release: "accepted",
        },
      }),
    ).toBe("conditional");

    const extensionDigest = computeEvidenceDigest({ extension: true });
    const admissionSubjectLocal = subject;
    const admissionEvidence = {
      extensionDigest,
      admissionDigest: computeFormalAdmissionDigest({
        admission: { extensionDigest, admissionDigest: computeEvidenceDigest({ p: 1 }) },
        subject: admissionSubjectLocal,
      }),
    };
    admissionEvidence.admissionDigest = computeFormalAdmissionDigest({
      admission: admissionEvidence,
      subject: admissionSubjectLocal,
    });
    const epochChainEvidence = {
      fromEpochId: admissionSubjectLocal.fromEpochId,
      toEpochId: admissionSubjectLocal.toEpochId,
      chainDigest: computeCrossEpochChainDigest({
        epochChain: {
          fromEpochId: admissionSubjectLocal.fromEpochId,
          toEpochId: admissionSubjectLocal.toEpochId,
          chainDigest: computeEvidenceDigest({ p: 1 }),
        },
        subject: admissionSubjectLocal,
      }),
    };
    const protocolOk = engine.verifyCanonicalProtocol({
      operational: {
        evidence: {
          projectionKind: "operational",
          soundDigest: computeEvidenceDigest({ sound: true }),
          reflectionDigest: computeEvidenceDigest({ reflection: true }),
        },
        evidenceDigest: computeOperationalProjectionDigest({
          projectionKind: "operational",
          soundDigest: computeEvidenceDigest({ sound: true }),
          reflectionDigest: computeEvidenceDigest({ reflection: true }),
        }),
      },
      probability: {
        bundle: {
          stableWindow: { windowDigest: computeEvidenceDigest({ w: 1 }) },
          fairness: { fairnessDigest: computeEvidenceDigest({ f: 1 }) },
          progress: { progressDigest: computeEvidenceDigest({ p: 1 }) },
        },
        evidenceDigest: computeProbabilityEvidenceDigest({
          stableWindow: { windowDigest: computeEvidenceDigest({ w: 1 }) },
          fairness: { fairnessDigest: computeEvidenceDigest({ f: 1 }) },
          progress: { progressDigest: computeEvidenceDigest({ p: 1 }) },
        }),
      },
      admission: {
        subject: admissionSubjectLocal,
        admission: admissionEvidence,
        epochChain: epochChainEvidence,
      },
    });
    expect(protocolOk.ok).toBe(true);
  });

  it("verifyCanonicalProtocol returns violations for bad probability bundle", () => {
    const admissionSubjectLocal = {
      admissionId: "adm-engine-protocol-fail",
      activationDomainId: "default",
      fromSchemaRef: schemaRef(
        schemaId("default-v1"),
        schemaRevisionId("rev-001"),
        schemaDigest("a"),
      ),
      toSchemaRef: schemaRef(
        schemaId("default-v1"),
        schemaRevisionId("rev-002"),
        schemaDigest("b"),
      ),
      fromEpochId: "42",
      toEpochId: "43",
      fromEpochOrdinal: 1,
      toEpochOrdinal: 2,
      extensionPlanDigest: "plan-digest",
      expectedRuntimeHead: "snap-S0",
      expectedBindingGeneration: 1,
    };
    const extensionDigest = computeEvidenceDigest({ extension: true });
    const result = engine.verifyCanonicalProtocol({
      operational: {
        evidence: {
          projectionKind: "operational",
          soundDigest: computeEvidenceDigest({ sound: true }),
          reflectionDigest: computeEvidenceDigest({ reflection: true }),
        },
        evidenceDigest: computeOperationalProjectionDigest({
          projectionKind: "operational",
          soundDigest: computeEvidenceDigest({ sound: true }),
          reflectionDigest: computeEvidenceDigest({ reflection: true }),
        }),
      },
      probability: {
        bundle: {
          stableWindow: { windowDigest: "bad" as never },
          fairness: { fairnessDigest: computeEvidenceDigest({ f: 1 }) },
          progress: { progressDigest: computeEvidenceDigest({ p: 1 }) },
        },
        evidenceDigest: computeEvidenceDigest({ bad: true }),
      },
      admission: {
        subject: admissionSubjectLocal,
        admission: { extensionDigest, admissionDigest: computeEvidenceDigest({ p: 1 }) },
        epochChain: {
          fromEpochId: admissionSubjectLocal.fromEpochId,
          toEpochId: admissionSubjectLocal.toEpochId,
          chainDigest: computeEvidenceDigest({ chain: true }),
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it("verifyPackage uses cache on second call", async () => {
    const evidenceStore = createMemoryEvidenceStore();
    await seedEvidenceArtifacts(evidenceStore);
    const cachedEngine = createConformanceEngine({
      evidenceStore,
      trustStore: createMemoryTrustStore(),
      revocationStore: createMemoryRevocationStore(),
      cache: createMemoryVerificationCache(),
      audit: createNoopAuditSink(),
    });
    const input = {
      manifest: sampleManifest(),
      inventory: sampleInventory(),
      observedRuleIds: [...SAMPLE_OBSERVED],
      evidenceArtifactDigests: [...FIXTURE_ARTIFACT_DIGESTS],
    };
    const first = await cachedEngine.verifyPackage(input);
    const second = await cachedEngine.verifyPackage(input);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.cacheKey).toBeDefined();
    }
  });
});
