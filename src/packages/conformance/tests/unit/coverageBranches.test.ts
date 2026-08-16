import { createPrivateKey, sign } from "node:crypto";
import { writeFileSync, mkdtempSync, rmSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import { evaluateAdmissionConformanceGate } from "../../src/engine/admissionConformanceGate.js";
import {
  evaluateReleaseConformanceGate,
  evaluateReleaseConformanceGateLegacy,
  validateReleaseGateInput,
} from "../../src/engine/releaseConformanceGate.js";
import {
  consumeSealedAdmissionDecision,
  validateSealedAdmissionPrepare,
} from "../../src/engine/sealedAdmissionGate.js";
import { decisionAccepted } from "../../src/foundation/verificationDecision.js";
import {
  applyVerificationDecision,
  initialLifecycleState,
  transitionHumanReviewed,
  transitionIssued,
  transitionMachineVerified,
  transitionParsed,
} from "../../src/lifecycle/certificateLifecycle.js";
import { deepFreeze } from "../../src/lifecycle/deepFreeze.js";
import { revokeCertificate, isRevokedState } from "../../src/lifecycle/revocation.js";
import { supersedeCertificate, isSupersededState } from "../../src/lifecycle/supersession.js";
import { submitHumanReview, reviewApproved } from "../../src/lifecycle/reviewWorkflow.js";
import {
  isReviewedDecision,
  isVerifiedDecision,
  sealReviewedDecision,
  sealVerifiedDecision,
} from "../../src/lifecycle/sealedDecision.js";
import { isSignedHumanReviewAttestation } from "../../src/certificate/signedHumanReviewAttestation.js";
import type { SignedHumanReviewAttestation } from "../../src/certificate/signedHumanReviewAttestation.js";
import {
  validateConformanceTargetManifest,
  requiredEvidenceClasses,
} from "../../src/verifier/manifestVerifier.js";
import { validateRuleInventory } from "../../src/manifest/ruleInventory.js";
import { verifyHumanReviewAttestation } from "../../src/verifier/humanReviewAttestationVerifier.js";
import { verifyLeanBuildAttestation } from "../../src/verifier/leanAttestationVerifier.js";
import { verifyPackageEvidence } from "../../src/verifier/packageVerifier.js";
import { verifyEngineeringAdmissionEvidence } from "../../src/verifier/engineeringAdmissionVerifier.js";
import { validateProofObligationsManifest } from "../../src/manifest/formalProofManifestBinding.js";
import { extractAdmissionSubjectFields } from "../../src/subject/admissionSubjectEquality.js";
import { acquireFileLock, withFileLockAsync } from "../../src/adapters/file/fileLock.js";
import { verifyEvidenceEnvelope } from "../../src/verifier/envelopeVerifier.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import {
  createMemoryCryptoVerifier,
  createMemoryEvidenceStore,
  createMemoryRevocationStore,
  createMemoryTrustStore,
} from "../../src/adapters/memory/index.js";
import { DEFAULT_VERIFICATION_POLICY } from "../../src/policy/verificationPolicy.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";
import {
  buildReviewedEngineeringAdmissionForTest,
  createTestReviewerTrustStore,
  defaultTestReviewerTrustStore,
  TEST_REVIEWER_KEY_ID,
  TEST_REVIEWER_PRIVATE_KEY,
  TEST_REVIEWER_PUBLIC_KEY,
} from "../../src/testing/index.js";
import {
  computeLeanBuildAttestationDigest,
  type LeanBuildAttestation,
} from "../../src/evidence/leanBuildAttestation.js";
import { canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";
import { domainSeparatedPayload } from "../../src/canonical/signatureDomain.js";
import { parseLeanAttestationFixture } from "../../src/testing/leanAttestationFixture.js";
import { createConformanceEngine } from "../../src/engine/conformanceEngine.js";
import {
  createNoopAuditSink,
  createMemoryVerificationCache,
} from "../../src/adapters/memory/index.js";
import { resolveRecipeSnapshot } from "../../src/adapters/runtime/replayRecipeSnapshot.js";
import type { PackageConformanceCertificate } from "../../src/certificate/packageConformanceCertificate.js";
import type { ConformanceTargetManifest } from "../../src/manifest/conformanceTargetManifest.js";
import type { VersionedEvidenceEnvelope } from "../../src/foundation/versionedEvidenceEnvelope.js";
import {
  verificationRunId,
  certificateId,
  CANONICAL_ENCODING_VERSION,
} from "../../src/foundation/conformanceId.js";
import {
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
  sampleLeanAttestationWire,
} from "../support/conformanceFixtures.js";

function signWithTestKey(payload: Uint8Array): string {
  const key = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(TEST_REVIEWER_PRIVATE_KEY),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const message = domainSeparatedPayload("attestation", payload);
  return sign(null, Buffer.from(message), key).toString("base64");
}

function leanBuilderTrustStore() {
  return {
    version: "trust/lean-test",
    getRoots(scope: string) {
      if (scope !== "conformance/lean-builder") {
        return [];
      }
      return [
        {
          keyId: "lean-builder-test",
          publicKey: TEST_REVIEWER_PUBLIC_KEY,
          scope: ["lean-builder"],
          notBefore: "2020-01-01T00:00:00.000Z",
          expiresAt: "2099-12-31T23:59:59.999Z",
        },
      ];
    },
  };
}

function signedLeanAttestation(
  overrides: Partial<LeanBuildAttestation> = {},
): LeanBuildAttestation {
  const base = parseLeanAttestationFixture(sampleLeanAttestationWire());
  if (base === undefined) {
    throw new Error("fixture parse failed");
  }
  const attestation: LeanBuildAttestation = { ...base, keyId: "lean-builder-test", ...overrides };
  const attestationDigest = computeLeanBuildAttestationDigest(attestation) as string;
  const payload = canonicalJsonBytes({
    attestationDigest,
    builderIdentity: attestation.builderIdentity,
    gitCommit: attestation.gitCommit,
    gitTree: attestation.gitTree,
  });
  return { ...attestation, signature: signWithTestKey(payload) };
}

describe("coverage branch exercises", () => {
  const from = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-001"), schemaDigest("a"));
  const to = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-002"), schemaDigest("b"));
  const subject = {
    admissionId: "adm-cov",
    activationDomainId: "default",
    fromSchemaRef: from,
    toSchemaRef: to,
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
    evidenceRef: "evidence://cov/1",
  };

  it("admissionConformanceGate and decisionAccepted branches", () => {
    const verified = {
      runId: verificationRunId("run-adm"),
      profile: "engineeringAdmission" as const,
      status: { ...initialConformanceStatus(), machine: "verified" as const },
      violations: [],
      evidenceRootDigest: computeEvidenceDigest({ adm: true }),
      decidedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(evaluateAdmissionConformanceGate(verified)).toBe("conditional");
    expect(evaluateAdmissionConformanceGate({ ...verified, profile: "fourProjection" })).toBe(
      "blocked",
    );
    expect(
      evaluateAdmissionConformanceGate({
        ...verified,
        violations: [{ code: "missing_evidence", message: "x" }],
      }),
    ).toBe("blocked");
    expect(
      decisionAccepted({
        ...verified,
        status: {
          ...initialConformanceStatus(),
          machine: "verified",
          humanReview: "approved",
          release: "accepted",
        },
      }),
    ).toBe(true);
    expect(
      decisionAccepted({
        ...verified,
        status: { ...initialConformanceStatus(), machine: "invalid" },
      }),
    ).toBe(false);
  });

  it("release gate legacy and conditional paths", () => {
    const base = {
      runId: verificationRunId("run-rel"),
      profile: "engineeringAdmission" as const,
      status: initialConformanceStatus(),
      violations: [],
      evidenceRootDigest: computeEvidenceDigest({ rel: true }),
      decidedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(
      evaluateReleaseConformanceGateLegacy({
        ...base,
        status: { ...initialConformanceStatus(), release: "accepted", humanReview: "approved" },
      }),
    ).toBe("accepted");
    expect(
      evaluateReleaseConformanceGateLegacy({
        ...base,
        status: { ...initialConformanceStatus(), release: "blocked" },
      }),
    ).toBe("blocked");
    expect(
      evaluateReleaseConformanceGateLegacy({
        ...base,
        status: { ...initialConformanceStatus(), release: "revoked" },
      }),
    ).toBe("blocked");
    expect(evaluateReleaseConformanceGateLegacy(base)).toBe("conditional");

    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const root = built.value.reviewedDecision.verified.decision.evidenceRootDigest;
    const certificate = {
      certificateId: "cert-cond",
      certificateSchemaVersion: 1,
      evidenceRootDigest: root,
      notBefore: "2020-01-01T00:00:00.000Z",
      expiresAt: "2099-12-31T23:59:59.999Z",
      status: { ...initialConformanceStatus(), release: "notEvaluated", humanReview: "approved" },
    } as PackageConformanceCertificate;
    expect(
      evaluateReleaseConformanceGate({
        reviewed: built.value.reviewedDecision,
        certificate,
        now: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("conditional");
    expect(
      validateReleaseGateInput({
        reviewed: built.value.reviewedDecision,
        certificate: { ...certificate, certificateSchemaVersion: 2 as never },
        now: "2026-01-01T00:00:00.000Z",
      }).some((v) => v.message.includes("schema version")),
    ).toBe(true);
    expect(
      validateReleaseGateInput({
        reviewed: sealReviewedDecision({
          verified: built.value.reviewedDecision.verified,
          reviewerId: "r",
          reviewDecision: "rejected",
          reviewedAt: "2026-01-01T00:00:00.000Z",
        }),
        certificate,
        now: "2026-01-01T00:00:00.000Z",
      }).some((v) => v.message.includes("approved human review")),
    ).toBe(true);
  });

  it("manifest and rule inventory validation branches", () => {
    expect(
      validateConformanceTargetManifest(sampleManifest({ manifestSchemaVersion: 2 as never }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateConformanceTargetManifest(sampleManifest({ claimScope: "invalid" as never })).some(
        (v) => v.code === "scope_escalation",
      ),
    ).toBe(true);
    expect(
      validateConformanceTargetManifest(sampleManifest({ requestedProfile: "unknown" as never }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateConformanceTargetManifest(
        sampleManifest({ evidenceRootDigest: "bad" as never }),
      ).some((v) => v.code === "digest_mismatch"),
    ).toBe(true);
    expect(
      validateConformanceTargetManifest(sampleManifest({ ruleInventoryRef: "" })).length,
    ).toBeGreaterThan(0);
    const productManifest = sampleManifest({ claimScope: "product" });
    const {
      packageName: _packageName,
      packageVersion: _packageVersion,
      ...productWithoutPackage
    } = productManifest;
    expect(
      validateConformanceTargetManifest(productWithoutPackage as ConformanceTargetManifest).length,
    ).toBeGreaterThan(0);
    expect(requiredEvidenceClasses("engineeringAdmission").length).toBeGreaterThan(0);
    expect(
      validateRuleInventory(
        sampleInventory({
          entries: [
            { ruleId: "a", ruleKind: "k", theoryRef: "t" },
            { ruleId: "a", ruleKind: "k", theoryRef: "t" },
          ],
        }),
      ),
    ).toContain("duplicate ruleId: a");
    expect(
      validateRuleInventory(
        sampleInventory({ entries: [{ ruleId: "", ruleKind: "k", theoryRef: "t" }] }),
      ),
    ).toContain("empty ruleId");
  });

  it("formal proof manifest validator negative branches", () => {
    expect(validateProofObligationsManifest(null).length).toBeGreaterThan(0);
    expect(
      validateProofObligationsManifest({ schemaVersion: 0, requiredGate: "x", obligations: [] })
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateProofObligationsManifest({
        schemaVersion: 1,
        requiredGate: "proved",
        obligations: [
          {
            id: "A",
            theorem: "t",
            status: "unknown-status",
            leanSymbol: "s",
            verifiedCommit: "a".repeat(40),
            buildEvidence: "e",
            buildEvidenceSha256: "f".repeat(64),
          },
          {
            id: "A",
            theorem: "t",
            status: "proved",
            leanSymbol: "s",
            verifiedCommit: "b".repeat(40),
            buildEvidence: "e2",
            buildEvidenceSha256: "c".repeat(64),
          },
        ],
      }).length,
    ).toBeGreaterThan(0);
  });

  it("human review attestation negative branches", async () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const verified = built.value.reviewedDecision.verified;
    const signed = built.value.signedAttestation;
    const deps = {
      trustStore: defaultTestReviewerTrustStore(),
      crypto: createMemoryCryptoVerifier(),
      requiredRoles: ["formal", "security"] as const,
      now: "2026-01-01T00:00:00.000Z",
    };

    expect(
      (
        await verifyHumanReviewAttestation(
          {
            reviewerId: "x",
            roles: [],
            decision: "approved",
            machineDecisionRef: "a",
            reviewedAt: "t",
          },
          verified,
          deps,
        )
      ).some((v) => v.message.includes("keyId")),
    ).toBe(true);
    expect(
      (
        await verifyHumanReviewAttestation(
          { ...signed, attestationDigest: "f".repeat(64) } as SignedHumanReviewAttestation,
          verified,
          deps,
        )
      ).some((v) => v.message.includes("digest mismatch")),
    ).toBe(true);
    expect(
      (
        await verifyHumanReviewAttestation(
          { ...signed, machineDecisionRef: "f".repeat(64) },
          verified,
          deps,
        )
      ).some((v) => v.message.includes("sealed machine decision")),
    ).toBe(true);
    expect(
      (
        await verifyHumanReviewAttestation(
          { ...signed, keyId: "missing" } as SignedHumanReviewAttestation,
          verified,
          deps,
        )
      ).some((v) => v.code === "trust_invalid"),
    ).toBe(true);

    const expiredStore = createTestReviewerTrustStore([
      {
        keyId: TEST_REVIEWER_KEY_ID,
        publicKey: TEST_REVIEWER_PUBLIC_KEY,
        scope: ["formal", "security"],
        notBefore: "2099-01-01T00:00:00.000Z",
        expiresAt: "2099-12-31T23:59:59.999Z",
      },
    ]);
    expect(
      (
        await verifyHumanReviewAttestation(signed, verified, { ...deps, trustStore: expiredStore })
      ).some((v) => v.message.includes("validity window")),
    ).toBe(true);

    expect(
      (await verifyHumanReviewAttestation({ ...signed, roles: ["formal"] }, verified, deps)).some(
        (v) => v.message.includes("missing required role"),
      ),
    ).toBe(true);

    const narrowStore = createTestReviewerTrustStore([
      {
        keyId: TEST_REVIEWER_KEY_ID,
        publicKey: TEST_REVIEWER_PUBLIC_KEY,
        scope: ["formal"],
        notBefore: "2020-01-01T00:00:00.000Z",
        expiresAt: "2099-12-31T23:59:59.999Z",
      },
    ]);
    expect(
      (
        await verifyHumanReviewAttestation(signed, verified, { ...deps, trustStore: narrowStore })
      ).some((v) => v.message.includes("not scoped for role")),
    ).toBe(true);

    expect(
      (
        await verifyHumanReviewAttestation({ ...signed, roles: ["formal"] }, verified, {
          ...deps,
          requiredRoles: ["formal", "security"],
        })
      ).some((v) => v.message.includes("quorum")),
    ).toBe(true);

    expect(
      (
        await verifyHumanReviewAttestation(
          {
            ...signed,
            signature: Buffer.from("bad").toString("base64"),
          } as SignedHumanReviewAttestation,
          verified,
          deps,
        )
      ).some((v) => v.message.includes("signature invalid")),
    ).toBe(true);

    expect(
      (
        await verifyHumanReviewAttestation(
          { ...signed, attestationDigest: "z".repeat(64) } as SignedHumanReviewAttestation,
          verified,
          deps,
        )
      ).some((v) => v.code === "digest_mismatch"),
    ).toBe(true);
    expect(
      isSignedHumanReviewAttestation({
        ...signed,
        attestationDigest: "short",
      } as SignedHumanReviewAttestation),
    ).toBe(false);
  });

  it("review workflow and sealed admission negative branches", async () => {
    const built = buildReviewedEngineeringAdmissionForTest({ bundle, subject });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const verified = built.value.reviewedDecision.verified;
    const signed = built.value.signedAttestation;
    const gateDeps = {
      trustStore: defaultTestReviewerTrustStore(),
      crypto: createMemoryCryptoVerifier(),
      requiredReviewerRoles: ["formal", "security"] as const,
    };

    expect(submitHumanReview({ verified: { fake: true } as never, attestation: signed }).ok).toBe(
      false,
    );
    expect(
      submitHumanReview({
        verified,
        attestation: {
          reviewerId: "x",
          roles: [],
          decision: "approved",
          machineDecisionRef: "a",
          reviewedAt: "t",
        },
      }).ok,
    ).toBe(false);
    expect(
      submitHumanReview({
        verified: {
          ...verified,
          decision: {
            ...verified.decision,
            status: { ...verified.decision.status, machine: "invalid" as const },
          },
        },
        attestation: signed,
      }).ok,
    ).toBe(false);
    expect(
      submitHumanReview({
        verified: {
          ...verified,
          decision: {
            ...verified.decision,
            violations: [{ code: "missing_evidence", message: "v" }],
          },
        },
        attestation: { ...signed, decision: "approved" },
      }).ok,
    ).toBe(false);
    expect(
      submitHumanReview({
        verified,
        attestation: { ...signed, machineDecisionRef: "f".repeat(64) },
      }).ok,
    ).toBe(false);

    const rejected = sealReviewedDecision({
      verified,
      reviewerId: "r",
      reviewDecision: "rejected",
      reviewedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(reviewApproved(rejected)).toBe(false);
    expect(consumeSealedAdmissionDecision(rejected).ok).toBe(false);

    expect(
      (
        await validateSealedAdmissionPrepare(
          {
            reviewedDecision: rejected,
            signedAttestation: signed,
            bundle,
            subject,
          },
          gateDeps,
        )
      ).ok,
    ).toBe(false);

    const wrongProfile = sealReviewedDecision({
      verified: sealVerifiedDecision({
        decision: { ...verified.decision, profile: "fourProjection" },
        verifiedAt: verified.verifiedAt,
        verifierBuild: verified.verifierBuild,
      }),
      reviewerId: "r",
      reviewDecision: "approved",
      reviewedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(
      (
        await validateSealedAdmissionPrepare(
          { reviewedDecision: wrongProfile, signedAttestation: signed, bundle, subject },
          gateDeps,
        )
      ).ok,
    ).toBe(false);

    const badVerifier = sealReviewedDecision({
      verified: sealVerifiedDecision({
        decision: verified.decision,
        verifiedAt: verified.verifiedAt,
        verifierBuild: "wrong/build",
      }),
      reviewerId: "r",
      reviewDecision: "approved",
      reviewedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(
      (
        await validateSealedAdmissionPrepare(
          { reviewedDecision: badVerifier, signedAttestation: signed, bundle, subject },
          gateDeps,
        )
      ).ok,
    ).toBe(false);

    expect(consumeSealedAdmissionDecision(built.value.reviewedDecision).ok).toBe(true);
    expect(isReviewedDecision({ fake: true })).toBe(false);
    expect(isVerifiedDecision(verified)).toBe(true);
  });

  it("certificate lifecycle, revocation, and supersession branches", () => {
    expect(transitionParsed(sampleManifest({ manifestSchemaVersion: 2 as never })).ok).toBe(false);
    const parsed = transitionParsed(sampleManifest());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(transitionMachineVerified(parsed.value, { fake: true } as never).ok).toBe(false);
    expect(
      transitionMachineVerified(
        { ...parsed.value, state: "issued" },
        sealVerifiedDecision({
          decision: {
            runId: verificationRunId("r"),
            profile: "engineeringAdmission",
            status: { ...initialConformanceStatus(), machine: "verified" },
            violations: [],
            evidenceRootDigest: parsed.value.certificateId,
            decidedAt: "2026-01-01T00:00:00.000Z",
          },
          verifiedAt: "2026-01-01T00:00:00.000Z",
          verifierBuild: "test",
        }),
      ).ok,
    ).toBe(false);

    const sealed = sealVerifiedDecision({
      decision: {
        runId: verificationRunId("r"),
        profile: "engineeringAdmission",
        status: { ...initialConformanceStatus(), machine: "verified" },
        violations: [],
        evidenceRootDigest: parsed.value.certificateId,
        decidedAt: "2026-01-01T00:00:00.000Z",
      },
      verifiedAt: "2026-01-01T00:00:00.000Z",
      verifierBuild: "test",
    });
    const machine = transitionMachineVerified(parsed.value, sealed);
    expect(machine.ok).toBe(true);
    if (!machine.ok) {
      return;
    }
    expect(
      transitionHumanReviewed(
        parsed.value,
        sealReviewedDecision({
          verified: sealed,
          reviewerId: "r",
          reviewDecision: "approved",
          reviewedAt: "2026-01-02T00:00:00.000Z",
        }),
      ).ok,
    ).toBe(false);

    const reviewed = sealReviewedDecision({
      verified: sealed,
      reviewerId: "r",
      reviewDecision: "approved",
      reviewedAt: "2026-01-02T00:00:00.000Z",
    });
    const human = transitionHumanReviewed(machine.value, reviewed);
    expect(human.ok).toBe(true);
    if (!human.ok) {
      return;
    }
    const certificate = {
      certificateId: "other-id",
      issuedAt: "2026-01-03T00:00:00.000Z",
    } as PackageConformanceCertificate;
    expect(transitionIssued(human.value, certificate, reviewed).ok).toBe(false);
    expect(
      transitionIssued(
        human.value,
        { ...certificate, certificateId: certificateId(parsed.value.certificateId) },
        sealReviewedDecision({
          verified: sealed,
          reviewerId: "r",
          reviewDecision: "rejected",
          reviewedAt: "2026-01-02T00:00:00.000Z",
        }),
      ).ok,
    ).toBe(false);

    expect(
      applyVerificationDecision(parsed.value, {
        runId: verificationRunId("r"),
        profile: "engineeringAdmission",
        status: { ...initialConformanceStatus(), machine: "verified" },
        violations: [],
        evidenceRootDigest: parsed.value.certificateId,
        decidedAt: "2026-01-01T00:00:00.000Z",
      }).ok,
    ).toBe(true);
    const verifiedTransition = applyVerificationDecision(parsed.value, {
      runId: verificationRunId("r"),
      profile: "engineeringAdmission",
      status: { ...initialConformanceStatus(), machine: "verified" },
      violations: [],
      evidenceRootDigest: parsed.value.certificateId,
      decidedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(verifiedTransition.ok).toBe(true);
    if (verifiedTransition.ok) {
      expect(verifiedTransition.value.state).toBe("machineVerified");
    }
    const invalidTransition = applyVerificationDecision(parsed.value, {
      runId: verificationRunId("r"),
      profile: "engineeringAdmission",
      status: { ...initialConformanceStatus(), machine: "invalid" },
      violations: [],
      evidenceRootDigest: parsed.value.certificateId,
      decidedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(invalidTransition.ok).toBe(true);
    if (invalidTransition.ok) {
      expect(invalidTransition.value.state).toBe("candidate");
    }
    expect(initialLifecycleState()).toBe("candidate");

    const issued = {
      certificateId: parsed.value.certificateId,
      state: "issued" as const,
      updatedAt: "t",
    };
    expect(
      revokeCertificate(issued, {
        certificateId: certificateId(parsed.value.certificateId),
        reason: "r",
        checkpoint: "c",
      }).ok,
    ).toBe(true);
    expect(
      revokeCertificate(parsed.value, {
        certificateId: certificateId(parsed.value.certificateId),
        reason: "r",
        checkpoint: "c",
      }).ok,
    ).toBe(false);
    expect(
      revokeCertificate(issued, {
        certificateId: certificateId("wrong"),
        reason: "r",
        checkpoint: "c",
      }).ok,
    ).toBe(false);
    expect(isRevokedState({ ...issued, state: "revoked" })).toBe(true);

    const successor = {
      certificateId: "next",
      supersedes: parsed.value.certificateId,
    } as PackageConformanceCertificate;
    expect(
      supersedeCertificate(issued, {
        priorCertificateId: certificateId(parsed.value.certificateId),
        successor,
      }).ok,
    ).toBe(true);
    expect(
      supersedeCertificate(parsed.value, {
        priorCertificateId: certificateId(parsed.value.certificateId),
        successor,
      }).ok,
    ).toBe(false);
    expect(
      supersedeCertificate(issued, {
        priorCertificateId: certificateId(parsed.value.certificateId),
        successor: { ...successor, supersedes: certificateId("wrong") },
      }).ok,
    ).toBe(false);
    expect(isSupersededState({ ...issued, state: "superseded" })).toBe(true);
  });

  it("engineering admission schema mismatch branches", () => {
    const complete = {
      ...subject,
      dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
      resourceDigest: computeEvidenceDigest({ facet: "resource" }),
      sessionDigest: computeEvidenceDigest({ facet: "session" }),
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
      verifierVersion: "conformance/3.0-m2",
      evidenceRef: "evidence://cov/1",
    };
    expect(
      verifyEngineeringAdmissionEvidence({
        bundle: complete,
        subject: {
          ...subject,
          fromSchemaRef: schemaRef(
            schemaId("other"),
            schemaRevisionId("rev-001"),
            schemaDigest("a"),
          ),
        },
      }).ok,
    ).toBe(false);
    expect(
      verifyEngineeringAdmissionEvidence({
        bundle: {
          ...complete,
          fromSchemaRef: schemaRef(
            schemaId("default-v1"),
            schemaRevisionId("rev-001"),
            schemaDigest("z"),
          ),
        },
        subject,
      }).ok,
    ).toBe(false);
    expect(
      verifyEngineeringAdmissionEvidence({
        bundle: {
          ...complete,
          toSchemaRef: schemaRef(
            schemaId("default-v1"),
            schemaRevisionId("rev-002"),
            schemaDigest("z"),
          ),
        },
        subject,
      }).ok,
    ).toBe(false);
    expect(
      verifyEngineeringAdmissionEvidence({
        bundle: {
          ...complete,
          fromSchemaRef: schemaRef(
            schemaId("other-family"),
            schemaRevisionId("rev-001"),
            schemaDigest("a"),
          ),
        },
        subject: {
          ...subject,
          fromSchemaRef: schemaRef(
            schemaId("default-v1"),
            schemaRevisionId("rev-001"),
            schemaDigest("a"),
          ),
        },
      }).ok,
    ).toBe(false);
  });

  it("lean attestation verifier happy and extra negative paths", async () => {
    const attestation = signedLeanAttestation();
    const digest = computeLeanBuildAttestationDigest(attestation) as string;
    const okResult = await verifyLeanBuildAttestation({
      attestation,
      proofManifestRef: `proof-manifest/${attestation.proofManifestDigest}`,
      payloadDigest: digest,
      trustStore: leanBuilderTrustStore(),
      crypto: createMemoryCryptoVerifier(),
      now: () => "2026-01-01T00:00:00.000Z",
    });
    expect(okResult.ok).toBe(true);

    const incomplete = { ...attestation, gitCommit: "bad" };
    expect(
      (
        await verifyLeanBuildAttestation({
          attestation: incomplete,
          proofManifestRef: "not-a-ref",
          payloadDigest: digest,
          trustStore: leanBuilderTrustStore(),
          crypto: createMemoryCryptoVerifier(),
        })
      ).ok,
    ).toBe(false);

    const trustResult = await verifyLeanBuildAttestation({
      attestation,
      proofManifestRef: `proof-manifest/${attestation.proofManifestDigest}`,
      payloadDigest: digest,
      trustStore: createMemoryTrustStore(),
      crypto: createMemoryCryptoVerifier(),
      now: () => "2026-01-01T00:00:00.000Z",
    });
    expect(trustResult.ok).toBe(false);
    if (!trustResult.ok) {
      expect(trustResult.error.some((v) => v.code === "trust_invalid")).toBe(true);
    }
  });

  it("package verifier policy, revocation, and product scope branches", async () => {
    const store = createMemoryEvidenceStore();
    const digest = computeEvidenceDigest({ artifact: true }) as string;
    await store.put(digest, canonicalJsonBytes({ artifact: true }));

    const revokedStore = {
      checkpoint: "revoked-test",
      async isRevoked(certificateId: string) {
        return certificateId === sampleManifest().evidenceRootDigest;
      },
    };

    expect(
      (
        await verifyPackageEvidence(
          {
            manifest: sampleManifest(),
            inventory: sampleInventory({ inventorySchemaVersion: 2 as never }),
            observedRuleIds: [...SAMPLE_OBSERVED],
            evidenceArtifactDigests: [digest],
          },
          {
            evidenceStore: store,
            trustStore: createMemoryTrustStore(),
            revocationStore: createMemoryRevocationStore(),
            policy: DEFAULT_VERIFICATION_POLICY,
          },
        )
      ).some((v) => v.message.includes("inventorySchemaVersion")),
    ).toBe(true);

    expect(
      (
        await verifyPackageEvidence(
          {
            manifest: sampleManifest({ claimScope: "product" }),
            inventory: sampleInventory(),
            observedRuleIds: [...SAMPLE_OBSERVED],
            evidenceArtifactDigests: [digest],
          },
          {
            evidenceStore: store,
            trustStore: createMemoryTrustStore(),
            revocationStore: createMemoryRevocationStore(),
            policy: DEFAULT_VERIFICATION_POLICY,
          },
        )
      ).some((v) => v.code === "trust_invalid"),
    ).toBe(true);

    expect(
      (
        await verifyPackageEvidence(
          {
            manifest: sampleManifest(),
            inventory: sampleInventory(),
            observedRuleIds: [...SAMPLE_OBSERVED],
            evidenceArtifactDigests: [digest],
          },
          {
            evidenceStore: store,
            trustStore: createMemoryTrustStore(),
            revocationStore: revokedStore,
            policy: DEFAULT_VERIFICATION_POLICY,
          },
        )
      ).some((v) => v.code === "revoked"),
    ).toBe(true);
  });

  it("deep freeze, subject fields, envelope, engine helpers, replay snapshot", () => {
    const nested = deepFreeze({ a: [{ b: 1 }], c: Object.freeze({ d: 2 }) });
    expect(Object.isFrozen(nested)).toBe(true);
    expect(Object.isFrozen((nested as { a: unknown[] }).a[0])).toBe(true);
    expect(deepFreeze(42)).toBe(42);

    expect(extractAdmissionSubjectFields({ admissionId: "a", extra: true }).admissionId).toBe("a");

    const digest = computeEvidenceDigest({ env: true });
    const envelopeBase = {
      canonicalEncodingVersion: CANONICAL_ENCODING_VERSION,
      profile: "engineeringAdmission" as const,
      claimScope: "reference" as const,
      issuedAt: "2026-01-01T00:00:00.000Z",
    };
    const env: VersionedEvidenceEnvelope = {
      envelopeSchemaVersion: 2 as never,
      signatureAlgorithm: "ed25519",
      digestAlgorithm: "sha256",
      subjectDigest: digest,
      evidenceRootDigest: digest,
      payloadRef: "ref",
      ...envelopeBase,
    };
    expect(verifyEvidenceEnvelope(env, "2026-01-01T00:00:00.000Z").length).toBeGreaterThan(0);
    expect(
      verifyEvidenceEnvelope(
        {
          envelopeSchemaVersion: 1,
          signatureAlgorithm: "ed25519",
          digestAlgorithm: "sha256",
          subjectDigest: "bad",
          evidenceRootDigest: digest,
          payloadRef: "ref",
          ...envelopeBase,
        },
        "2026-01-01T00:00:00.000Z",
      ).some((v) => v.code === "digest_mismatch"),
    ).toBe(true);
    expect(
      verifyEvidenceEnvelope(
        {
          envelopeSchemaVersion: 1,
          signatureAlgorithm: "ed25519",
          digestAlgorithm: "sha256",
          subjectDigest: digest,
          evidenceRootDigest: digest,
          payloadRef: "",
          ...envelopeBase,
        },
        "2026-01-01T00:00:00.000Z",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      verifyEvidenceEnvelope(
        {
          envelopeSchemaVersion: 1,
          signatureAlgorithm: "ed25519",
          digestAlgorithm: "md5" as never,
          subjectDigest: digest,
          evidenceRootDigest: digest,
          payloadRef: "ref",
          ...envelopeBase,
        },
        "2026-01-01T00:00:00.000Z",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      verifyEvidenceEnvelope(
        {
          envelopeSchemaVersion: 1,
          signatureAlgorithm: "ed25519",
          digestAlgorithm: "sha256",
          subjectDigest: digest,
          evidenceRootDigest: digest,
          payloadRef: "ref",
          expiresAt: "2020-01-01T00:00:00.000Z",
          ...envelopeBase,
        },
        "2026-01-01T00:00:00.000Z",
      ).some((v) => v.code === "revoked"),
    ).toBe(true);

    const engine = createConformanceEngine({
      evidenceStore: createMemoryEvidenceStore(),
      trustStore: createMemoryTrustStore(),
      revocationStore: createMemoryRevocationStore(),
      cache: createMemoryVerificationCache(),
      audit: createNoopAuditSink(),
    });
    expect(
      engine.listMissingEvidence({ inventory: sampleInventory(), observedRuleIds: [] }),
    ).toContain("rule-native-1");
    expect(
      engine.explainDecision({
        runId: verificationRunId("r"),
        profile: "engineeringAdmission",
        status: initialConformanceStatus(),
        violations: [{ code: "missing_evidence", message: "missing" }],
        evidenceRootDigest: digest,
        decidedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toContain("missing_evidence");
    expect(
      engine.evaluateAdmissionGate({
        runId: verificationRunId("r"),
        profile: "engineeringAdmission",
        status: { ...initialConformanceStatus(), machine: "invalid" },
        violations: [],
        evidenceRootDigest: digest,
        decidedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("blocked");
    expect(
      engine.evaluateReleaseGate({
        runId: verificationRunId("r"),
        profile: "engineeringAdmission",
        status: { ...initialConformanceStatus(), release: "blocked" },
        violations: [],
        evidenceRootDigest: digest,
        decidedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("blocked");
    expect(
      engine.evaluateReleaseGate({
        runId: verificationRunId("r"),
        profile: "engineeringAdmission",
        status: { ...initialConformanceStatus(), humanReview: "pending" },
        violations: [],
        evidenceRootDigest: digest,
        decidedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("conditional");

    expect(resolveRecipeSnapshot({} as never, () => undefined)).toBeUndefined();
  });

  it("file lock fail-closed handling and async helper", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-lock-stale-"));
    try {
      const lockPath = join(dir, ".conformance.lock");
      writeFileSync(lockPath, "99999999:0", "utf8");
      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(/automatic recovery disabled/);
      expect(existsSync(lockPath)).toBe(true);
      unlinkSync(lockPath);

      await withFileLockAsync(dir, async () => {
        expect(existsSync(lockPath)).toBe(true);
      });
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
