import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { createMemoryConformanceEngine } from "../../src/adapters/memory/index.js";
import {
  createMemoryEvidenceStore,
  createMemoryTrustStore,
  createMemoryRevocationStore,
  createMemoryVerificationCache,
  createNoopAuditSink,
} from "../../src/adapters/memory/index.js";
import { createConformanceEngine } from "../../src/engine/conformanceEngine.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { computeDpoReplayExecutionDigest } from "../../src/verifier/dpoReplayVerifier.js";
import {
  computeCrossEpochChainDigest,
  computeFormalAdmissionDigest,
  computeOperationalProjectionDigest,
} from "../../src/verifier/admissionVerifier.js";
import { computeProbabilityEvidenceDigest } from "../../src/verifier/probabilityVerifier.js";
import { computeReplayEvidenceDigest } from "../../src/verifier/replayVerifier.js";
import { buildCommittedDpoReplayFixture } from "../support/dpoReplayFixture.js";
import type { RuleOccurrenceSubject } from "../../src/subject/admissionSubject.js";

describe("conformanceEngine verifier methods", () => {
  const engine = createMemoryConformanceEngine({ audit: createNoopAuditSink() });

  it("verifyDpoReplay returns verified when runtime port validates recipe chain", async () => {
    const { t0, changes, replayPort, recipeChainRef } = buildCommittedDpoReplayFixture();
    const dpoEngine = createConformanceEngine({
      evidenceStore: createMemoryEvidenceStore(),
      trustStore: createMemoryTrustStore(),
      revocationStore: createMemoryRevocationStore(),
      cache: createMemoryVerificationCache(),
      audit: createNoopAuditSink(),
      dpoReplayPort: replayPort,
    });
    const last = changes.at(-1)!;
    const subject: RuleOccurrenceSubject = {
      artifactSubjectRef: "artifact://pkg/1",
      signatureVersion: "sig-v1",
      epochId: "42",
      ruleId: "introduce_artifact",
      occurrenceId: "occ-001",
      beforeSnapshotRef: t0.snapshotRef as string,
      eventRef: changes[0]!.changeId as string,
      afterSnapshotRef: last.afterRef as string,
      replayRecipeRef: recipeChainRef,
    };
    const replayDigest = computeDpoReplayExecutionDigest({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        changeCount: changes.length,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
      },
      subject,
    });
    const result = await dpoEngine.verifyDpoReplay({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        replayDigest,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
        changes,
      },
      subject,
    });
    expect(result.ok).toBe(true);
  });

  it("verifyReplay returns verified decision for valid evidence", () => {
    const subject = {
      artifactSubjectRef: "artifact://pkg/1",
      signatureVersion: "sig-v1",
      epochId: "epoch-42",
      ruleId: "rule-native-1",
      occurrenceId: "occ-001",
      beforeSnapshotRef: "snap-before",
      eventRef: "event-001",
      afterSnapshotRef: "snap-after",
      replayRecipeRef: "recipe://replay/1",
    };
    const evidence = {
      recipeRef: subject.replayRecipeRef,
      deterministic: true,
      replayDigest: computeReplayEvidenceDigest({
        evidence: { recipeRef: subject.replayRecipeRef, deterministic: true },
        subject,
      }),
    };
    const result = engine.verifyReplay({ evidence, subject });
    expect(result.ok).toBe(true);
  });

  it("verifyCanonicalProtocol composes operational, probability, and admission evidence", () => {
    const subject = {
      admissionId: "adm-canonical",
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
    const operationalEvidence = {
      projectionKind: "operational" as const,
      soundDigest: computeEvidenceDigest({ facet: "sound" }),
      reflectionDigest: computeEvidenceDigest({ facet: "reflection" }),
    };
    const probabilityBundle = {
      stableWindow: { windowDigest: computeEvidenceDigest({ facet: "stableWindow" }) },
      fairness: { fairnessDigest: computeEvidenceDigest({ facet: "fairness" }) },
      progress: { progressDigest: computeEvidenceDigest({ facet: "progress" }) },
    };
    const admission = {
      extensionDigest: computeEvidenceDigest({ facet: "extension" }),
      admissionDigest: computeEvidenceDigest({ placeholder: true }),
    };
    admission.admissionDigest = computeFormalAdmissionDigest({ admission, subject });
    const epochChain = {
      fromEpochId: subject.fromEpochId,
      toEpochId: subject.toEpochId,
      chainDigest: computeEvidenceDigest({ placeholder: true }),
    };
    epochChain.chainDigest = computeCrossEpochChainDigest({ epochChain, subject });

    const result = engine.verifyCanonicalProtocol({
      operational: {
        evidence: operationalEvidence,
        evidenceDigest: computeOperationalProjectionDigest(operationalEvidence),
      },
      probability: {
        bundle: probabilityBundle,
        evidenceDigest: computeProbabilityEvidenceDigest(probabilityBundle),
      },
      admission: { subject, admission, epochChain },
    });
    expect(result.ok).toBe(true);
  });
});
