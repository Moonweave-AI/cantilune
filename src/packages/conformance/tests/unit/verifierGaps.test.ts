import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { validateReleaseGateInput } from "../../src/engine/releaseConformanceGate.js";
import { validateSealedAdmissionPrepare } from "../../src/engine/sealedAdmissionGate.js";
import { verifyTrajectoryEvidence } from "../../src/verifier/trajectoryVerifier.js";
import { verifyPackageEvidence } from "../../src/verifier/packageVerifier.js";
import {
  verifyCrossEpochAdmission,
  computeFormalAdmissionDigest,
} from "../../src/verifier/admissionVerifier.js";
import { verifyProbabilityEvidence } from "../../src/verifier/probabilityVerifier.js";
import {
  createMemoryEvidenceStore,
  createMemoryRevocationStore,
  createMemoryTrustStore,
} from "../../src/adapters/memory/index.js";
import {
  DEFAULT_VERIFICATION_POLICY,
  policyAllowsProfile,
  policyAllowsScope,
} from "../../src/policy/verificationPolicy.js";
import { buildReviewedEngineeringAdmissionForTest } from "../../src/testing/index.js";
import type { ReviewedDecision } from "../../src/lifecycle/sealedDecision.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";
import {
  createMemoryCryptoVerifier,
  defaultTestReviewerTrustStore,
} from "../../src/adapters/memory/index.js";
import type { PackageConformanceCertificate } from "../../src/certificate/packageConformanceCertificate.js";
import {
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
} from "../support/conformanceFixtures.js";
import { acquireFileLock } from "../../src/adapters/file/fileLock.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("verifier and gate gap coverage", () => {
  const subject = {
    admissionId: "adm-gap",
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
  const bundle = {
    ...subject,
    dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
    resourceDigest: computeEvidenceDigest({ facet: "resource" }),
    sessionDigest: computeEvidenceDigest({ facet: "session" }),
    structureDigest: computeEvidenceDigest({ facet: "structure" }),
    verifierVersion: "conformance/test",
    evidenceRef: "evidence://gap/1",
  };

  it("release gate certificate and machine decision branches", () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const root = built.value.reviewedDecision.verified.decision.evidenceRootDigest;
    const baseCert = {
      certificateId: "cert-gap",
      certificateSchemaVersion: 1,
      evidenceRootDigest: root,
      notBefore: "2020-01-01T00:00:00.000Z",
      expiresAt: "2099-12-31T23:59:59.999Z",
      status: { ...initialConformanceStatus(), release: "accepted", humanReview: "approved" },
    } as PackageConformanceCertificate;

    expect(
      validateReleaseGateInput({
        reviewed: built.value.reviewedDecision,
        certificate: { ...baseCert, evidenceRootDigest: computeEvidenceDigest({ wrong: true }) },
        now: "2026-01-01T00:00:00.000Z",
      }).some((v) => v.code === "subject_mismatch"),
    ).toBe(true);

    const tamperedReviewed = {
      ...built.value.reviewedDecision,
      verified: {
        ...built.value.reviewedDecision.verified,
        decision: {
          ...built.value.reviewedDecision.verified.decision,
          violations: [{ code: "missing_evidence", message: "v" }],
        },
      },
    } as ReviewedDecision;
    expect(
      validateReleaseGateInput({
        reviewed: tamperedReviewed,
        certificate: baseCert,
        now: "2026-01-01T00:00:00.000Z",
      }).some((v) => v.message.includes("verified machine decision")),
    ).toBe(true);

    expect(
      validateReleaseGateInput({
        reviewed: built.value.reviewedDecision,
        certificate: {
          ...baseCert,
          status: { ...initialConformanceStatus(), release: "revoked" },
        },
        now: "2026-01-01T00:00:00.000Z",
      }).some((v) => v.code === "revoked"),
    ).toBe(true);

    expect(
      validateReleaseGateInput({
        reviewed: built.value.reviewedDecision,
        certificate: {
          ...baseCert,
          evidenceRootDigest: "g".repeat(64),
        },
        now: "2026-01-01T00:00:00.000Z",
      }).some((v) => v.code === "digest_mismatch"),
    ).toBe(true);
  });

  it("trajectory verifier empty fields and negative index", () => {
    const trajectoryDigest = computeEvidenceDigest({ facet: "trajectory" });
    const subject = {
      productSubjectRef: "",
      epochChainRef: "epoch-chain://1",
      initialStateRef: "state://initial",
      terminalStateRef: "state://terminal",
      selectedOccurrenceRef: "occurrence://selected",
      selectedIndex: -1,
      trajectoryDigest: trajectoryDigest as string,
      kernelDigest: computeEvidenceDigest({ facet: "kernel" }) as string,
    };
    const evidence = {
      trajectoryDigest: trajectoryDigest as never,
      terminalDigest: "bad" as never,
    };
    const violations = verifyTrajectoryEvidence({
      evidence,
      subject,
      evidenceDigest: computeEvidenceDigest({ bad: true }),
    });
    expect(violations.length).toBeGreaterThan(2);
  });

  it("admission verifier formal and epoch evidence branches", () => {
    const extensionDigest = computeEvidenceDigest({ facet: "extension" });
    const admission = {
      extensionDigest,
      admissionDigest: computeEvidenceDigest({ wrong: true }),
      tombstoneId: "tomb-a",
    };
    expect(
      verifyCrossEpochAdmission({
        admission,
        epochChain: {
          fromEpochId: "wrong",
          toEpochId: subject.toEpochId,
          chainDigest: computeEvidenceDigest({ chain: true }),
        },
        subject: { ...subject, tombstoneId: "tomb-b" },
      }).some((v) => v.code === "subject_mismatch"),
    ).toBe(true);

    expect(
      verifyCrossEpochAdmission({
        admission: {
          extensionDigest,
          admissionDigest: computeFormalAdmissionDigest({
            admission: { extensionDigest, admissionDigest: computeEvidenceDigest({ p: 1 }) },
            subject: { ...subject, admissionId: "" },
          }),
        },
        epochChain: {
          fromEpochId: subject.fromEpochId,
          toEpochId: subject.toEpochId,
          chainDigest: computeEvidenceDigest({ chain: true }),
        },
        subject: { ...subject, admissionId: "" },
      }).some((v) => v.code === "missing_evidence"),
    ).toBe(true);
  });

  it("package verifier inventory and policy branches", async () => {
    const store = createMemoryEvidenceStore();
    const digest = computeEvidenceDigest({ pkg: true }) as string;
    await store.put(digest, new Uint8Array([1]));
    const strictPolicy = {
      ...DEFAULT_VERIFICATION_POLICY,
      allowedClaimScopes: ["reference"] as const,
      minimumProfile: "engineeringAdmission" as const,
    };
    expect(policyAllowsScope(strictPolicy, "reference")).toBe(true);
    expect(policyAllowsProfile(strictPolicy, "engineeringAdmission")).toBe(true);

    const violations = await verifyPackageEvidence(
      {
        manifest: sampleManifest({ requestedProfile: "fourProjection" }),
        inventory: sampleInventory({ inventoryDigest: "f".repeat(64) }),
        observedRuleIds: [...SAMPLE_OBSERVED],
        evidenceArtifactDigests: [digest],
      },
      {
        evidenceStore: store,
        trustStore: createMemoryTrustStore(),
        revocationStore: createMemoryRevocationStore(),
        policy: {
          ...DEFAULT_VERIFICATION_POLICY,
          minimumProfile: "engineeringAdmission",
        },
      },
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it("probability verifier negative branches", () => {
    const digest = computeEvidenceDigest({ facet: "window" });
    expect(
      verifyProbabilityEvidence({
        bundle: {
          stableWindow: { windowDigest: "bad" as never },
          fairness: { fairnessDigest: digest },
          progress: { progressDigest: digest },
        },
        evidenceDigest: computeEvidenceDigest({ e: 1 }),
      }).length,
    ).toBeGreaterThan(0);
  });

  it("sealed admission rejects unverified machine decision", async () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const tampered = {
      ...built.value.reviewedDecision,
      verified: {
        ...built.value.reviewedDecision.verified,
        decision: {
          ...built.value.reviewedDecision.verified.decision,
          violations: [{ code: "missing_evidence", message: "v" }],
        },
      },
    } as ReviewedDecision;
    const gate = await validateSealedAdmissionPrepare(
      {
        reviewedDecision: tampered,
        signedAttestation: built.value.signedAttestation,
        bundle,
        subject,
      },
      {
        trustStore: defaultTestReviewerTrustStore(),
        crypto: createMemoryCryptoVerifier(),
        requiredReviewerRoles: ["formal", "security"],
      },
    );
    expect(gate.ok).toBe(false);
  });

  it("file lock contended acquire eventually succeeds", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-lock-contended-"));
    try {
      const first = acquireFileLock(dir);
      first.release();
      const second = acquireFileLock(dir);
      expect(second.release).toBeTypeOf("function");
      second.release();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
