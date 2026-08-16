import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createMemoryConformanceEngine,
  createMemoryEvidenceStore,
  createMemoryTrustStore,
  createMemoryRevocationStore,
  createMemoryVerificationCache,
  createNoopAuditSink,
} from "../../src/adapters/memory/index.js";
import { createConformanceEngine } from "../../src/engine/conformanceEngine.js";
import {
  computeLeanBuildAttestationDigest,
  type LeanBuildAttestation,
} from "../../src/evidence/leanBuildAttestation.js";
import { parseLeanAttestationFixture } from "../../src/testing/leanAttestationFixture.js";
import { verifyLeanBuildAttestation } from "../../src/verifier/leanAttestationVerifier.js";
import { createMemoryCryptoVerifier } from "../../src/adapters/memory/memoryCryptoVerifier.js";
import {
  sampleInventory,
  sampleLeanAttestationWire,
  sampleManifest,
  SAMPLE_OBSERVED,
  FIXTURE_ARTIFACT_DIGESTS,
  seedEvidenceArtifacts,
} from "../support/conformanceFixtures.js";
import { requireCliBuilt, runCli } from "../support/runCli.js";

describe("L6 offline verification", () => {
  it("verifies package locally without network", async () => {
    const evidenceStore = createMemoryEvidenceStore();
    await seedEvidenceArtifacts(evidenceStore);
    const engine = createConformanceEngine({
      evidenceStore,
      trustStore: createMemoryTrustStore(),
      revocationStore: createMemoryRevocationStore(),
      cache: createMemoryVerificationCache(),
      audit: createNoopAuditSink(),
    });
    const result = await engine.verifyPackage({
      manifest: sampleManifest(),
      inventory: sampleInventory(),
      observedRuleIds: [...SAMPLE_OBSERVED],
      evidenceArtifactDigests: [...FIXTURE_ARTIFACT_DIGESTS],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status.machine).toBe("verified");
    }
  });

  it("rejects lean attestation without trusted builder key", async () => {
    const wire = sampleLeanAttestationWire();
    const attestation = parseLeanAttestationFixture(wire);
    expect(attestation).toBeDefined();
    if (attestation === undefined) {
      return;
    }
    const digest = computeLeanBuildAttestationDigest(attestation) as string;
    const proofManifestRef = `proof-manifest/${wire.proofManifestDigest}`;
    const result = await verifyLeanBuildAttestation({
      attestation: attestation as LeanBuildAttestation,
      proofManifestRef,
      payloadDigest: digest,
      trustStore: createMemoryTrustStore(),
      crypto: createMemoryCryptoVerifier(),
    });
    expect(result.ok).toBe(false);
  });

  it("runs full CLI verify flow from local fixture files only", () => {
    requireCliBuilt();
    const dir = mkdtempSync(join(tmpdir(), "conformance-offline-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      const artifactsPath = join(dir, "artifacts.json");
      const attestationPath = join(dir, "attestation.json");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([...SAMPLE_OBSERVED]), "utf8");
      writeFileSync(artifactsPath, JSON.stringify([...FIXTURE_ARTIFACT_DIGESTS]), "utf8");
      writeFileSync(attestationPath, JSON.stringify(sampleLeanAttestationWire()), "utf8");

      const attestation = parseLeanAttestationFixture(sampleLeanAttestationWire());
      expect(attestation).toBeDefined();
      const digest = computeLeanBuildAttestationDigest(attestation!) as string;

      const packageResult = runCli([
        "verify-package",
        "--manifest",
        manifestPath,
        "--inventory",
        inventoryPath,
        "--observed",
        observedPath,
        "--artifacts",
        artifactsPath,
      ]);
      expect(packageResult.exitCode).toBe(0);

      const leanResult = runCli([
        "verify-lean-attestation",
        "--attestation",
        attestationPath,
        "--payload-digest",
        digest,
        "--proof-manifest-ref",
        `proof-manifest/${sampleLeanAttestationWire().proofManifestDigest}`,
      ]);
      expect(leanResult.exitCode).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists missing evidence offline", () => {
    const engine = createMemoryConformanceEngine({ audit: createNoopAuditSink() });
    const missing = engine.listMissingEvidence({
      inventory: sampleInventory(),
      observedRuleIds: [],
    });
    expect(missing).toEqual(["rule-native-1"]);
  });
});
