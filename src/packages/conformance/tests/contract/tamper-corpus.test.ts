import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { schemaDigest, schemaId, schemaRevisionId, schemaRef } from "@cantilune/core";
import {
  createMemoryConformanceEngine,
  createNoopAuditSink,
} from "../../src/adapters/memory/index.js";
import { createMemoryCryptoVerifier } from "../../src/adapters/memory/memoryCryptoVerifier.js";
import { domainSeparatedPayload } from "../../src/canonical/signatureDomain.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { verifyEvidenceEnvelope } from "../../src/verifier/envelopeVerifier.js";
import { verifyEngineeringAdmissionEvidence } from "../../src/verifier/engineeringAdmissionVerifier.js";
import { verifyReplayEvidence } from "../../src/verifier/replayVerifier.js";
import { computeReplayEvidenceDigest } from "../../src/verifier/replayVerifier.js";
import { verifyRuleInventoryCompleteness } from "../../src/verifier/inventoryVerifier.js";
import {
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
} from "../support/conformanceFixtures.js";

describe("L5 tamper corpus", () => {
  const from = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-001"), schemaDigest("a"));
  const to = schemaRef(schemaId("default-v1"), schemaRevisionId("rev-002"), schemaDigest("b"));
  const subject = {
    admissionId: "adm-tamper",
    activationDomainId: "default",
    fromSchemaRef: from,
    toSchemaRef: to,
    fromEpochId: "42",
    toEpochId: "43",
    fromEpochOrdinal: 1,
    toEpochOrdinal: 2,
    extensionPlanDigest: "plan-digest",
    expectedRuntimeHead: "snap-S0",
    expectedBindingGeneration: 1,
  };

  it("rejects digest tampering in replay evidence binding", () => {
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
    expect(verifyReplayEvidence({ evidence, subject })).toEqual([]);

    const tampered = {
      ...evidence,
      replayDigest: computeEvidenceDigest({ tampered: true }) as typeof evidence.replayDigest,
    };
    const violations = verifyReplayEvidence({ evidence: tampered, subject });
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });

  it("rejects engineering admission subject digest binding mismatch", () => {
    const bundle = {
      ...subject,
      dependencyDigest: computeEvidenceDigest({ facet: "dependency" }),
      resourceDigest: computeEvidenceDigest({ facet: "resource" }),
      sessionDigest: computeEvidenceDigest({ facet: "session" }),
      structureDigest: computeEvidenceDigest({ facet: "structure" }),
      verifierVersion: "conformance/3.0-m2",
      evidenceRef: "evidence://four-view/1",
    };
    const rejected = verifyEngineeringAdmissionEvidence({
      bundle,
      subject: { ...subject, expectedBindingGeneration: 99 },
    });
    expect(rejected.ok).toBe(false);
  });

  it("rejects manifest scope tampering at verifyPackage", async () => {
    const engine = createMemoryConformanceEngine({ audit: createNoopAuditSink() });
    const result = await engine.verifyPackage({
      manifest: sampleManifest({ claimScope: "product" }),
      inventory: sampleInventory(),
      observedRuleIds: [...SAMPLE_OBSERVED],
      evidenceArtifactDigests: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((v) => v.code === "scope_escalation")).toBe(true);
    }

    const inspect = engine.inspectCandidate(sampleManifest({ claimScope: "product" }));
    expect(inspect.ok).toBe(false);
    if (!inspect.ok) {
      expect(inspect.error.some((v) => v.code === "scope_escalation")).toBe(true);
    }
  });

  it("rejects rule id tampering via inventory gate", () => {
    const inventory = sampleInventory({
      entries: [
        { ruleId: "rule-native-1", ruleKind: "native", theoryRef: "Execution.lean" },
        { ruleId: "rule-hidden", ruleKind: "native", theoryRef: "Execution.lean" },
      ],
    });
    const violations = verifyRuleInventoryCompleteness(inventory, ["rule-native-1"]);
    expect(violations.some((v) => v.code === "inventory_incomplete")).toBe(true);

    const extraViolations = verifyRuleInventoryCompleteness(sampleInventory(), [
      "rule-native-1",
      "rule-smuggled",
    ]);
    expect(extraViolations.some((v) => v.code === "inventory_extra")).toBe(true);
  });

  it("rejects signature field tampering", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const payload = new Uint8Array([1, 2, 3, 4]);
    const domain = "attestation" as const;
    const message = domainSeparatedPayload(domain, payload);
    const validSignature = sign(null, Buffer.from(message), privateKey);
    const verifier = createMemoryCryptoVerifier();
    const pubRaw = publicKey.export({ type: "spki", format: "der" }).subarray(-32);

    const accepted = await verifier.verifySignature(domain, payload, validSignature, pubRaw);
    expect(accepted).toBe(true);

    const tamperedSignature = new Uint8Array(validSignature);
    tamperedSignature[0] = (tamperedSignature[0] ?? 0) ^ 0xff;
    const rejected = await verifier.verifySignature(domain, payload, tamperedSignature, pubRaw);
    expect(rejected).toBe(false);
  });

  it("rejects envelope digest field tampering", () => {
    const violations = verifyEvidenceEnvelope(
      {
        envelopeSchemaVersion: 1,
        canonicalEncodingVersion: "conformance-canonical/v1",
        digestAlgorithm: "sha256",
        signatureAlgorithm: "ed25519",
        profile: "engineeringAdmission",
        claimScope: "reference",
        subjectDigest: "not-a-digest",
        evidenceRootDigest: computeEvidenceDigest({ ok: true }) as string,
        payloadRef: "payload://1",
        issuedAt: "2026-01-01T00:00:00.000Z",
      },
      "2026-06-01T00:00:00.000Z",
    );
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });
});
