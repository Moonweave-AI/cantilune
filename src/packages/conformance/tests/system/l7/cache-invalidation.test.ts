import { describe, expect, it, beforeEach } from "vitest";
import { createConformanceEngine } from "../../../src/engine/conformanceEngine.js";
import { createMemoryEvidenceStore } from "../../../src/adapters/memory/memoryEvidenceStore.js";
import { createMemoryTrustStore } from "../../../src/adapters/memory/memoryTrustStore.js";
import { createMemoryRevocationStore } from "../../../src/adapters/memory/memoryRevocationStore.js";
import { createMemoryVerificationCache } from "../../../src/adapters/memory/memoryVerificationCache.js";
import { createNoopAuditSink } from "../../../src/adapters/memory/memoryAuditSink.js";
import { cacheKeyString } from "../../../src/ports/verificationCache.js";
import { ENGINEERING_ADMISSION_VERIFIER_BUILD } from "../../../src/verifier/engineeringAdmissionVerifier.js";
import { DEFAULT_VERIFICATION_POLICY } from "../../../src/policy/verificationPolicy.js";
import {
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
  FIXTURE_ARTIFACT_DIGESTS,
  seedEvidenceArtifacts,
} from "../../support/conformanceFixtures.js";

function buildEngine(options: {
  readonly cache: ReturnType<typeof createMemoryVerificationCache>;
  readonly trustVersion: string;
  readonly revocationCheckpoint: string;
  readonly evidenceStore?: ReturnType<typeof createMemoryEvidenceStore>;
}) {
  return createConformanceEngine({
    evidenceStore: options.evidenceStore ?? createMemoryEvidenceStore(),
    trustStore: createMemoryTrustStore(options.trustVersion),
    revocationStore: createMemoryRevocationStore(options.revocationCheckpoint),
    cache: options.cache,
    audit: createNoopAuditSink(),
  });
}

describe("L7 verification cache invalidation", () => {
  const manifest = sampleManifest();
  const verifyInput = {
    manifest,
    inventory: sampleInventory(),
    observedRuleIds: [...SAMPLE_OBSERVED],
    evidenceArtifactDigests: [...FIXTURE_ARTIFACT_DIGESTS],
  };

  function cacheKeyFor(trustVersion: string, revocationCheckpoint: string) {
    return {
      subjectDigest: manifest.evidenceRootDigest,
      evidenceRootDigest: manifest.evidenceRootDigest,
      verifierBuild: ENGINEERING_ADMISSION_VERIFIER_BUILD,
      policyVersion: DEFAULT_VERIFICATION_POLICY.policyVersion,
      trustRootSetVersion: trustVersion,
      revocationCheckpoint,
    };
  }

  beforeEach(async () => {
    // evidence store seeded per test
  });

  it("returns cached decision on repeated verifyPackage with stable key material", async () => {
    const cache = createMemoryVerificationCache();
    const evidenceStore = createMemoryEvidenceStore();
    await seedEvidenceArtifacts(evidenceStore);
    const engine = buildEngine({
      cache,
      trustVersion: "trust/v1",
      revocationCheckpoint: "rev/v1",
      evidenceStore,
    });

    const first = await engine.verifyPackage(verifyInput);
    const second = await engine.verifyPackage(verifyInput);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.cacheKey).toBeDefined();
      expect(second.value.runId).toBe(first.value.runId);
      expect(cache.get(cacheKeyFor("trust/v1", "rev/v1"))).toBeDefined();
    }
  });

  it("misses cache when trust root set version changes", async () => {
    const cache = createMemoryVerificationCache();
    const evidenceStore = createMemoryEvidenceStore();
    await seedEvidenceArtifacts(evidenceStore);
    const engineV1 = buildEngine({
      cache,
      trustVersion: "trust/v1",
      revocationCheckpoint: "rev/v1",
      evidenceStore,
    });
    const engineV2 = buildEngine({
      cache,
      trustVersion: "trust/v2",
      revocationCheckpoint: "rev/v1",
      evidenceStore,
    });

    expect((await engineV1.verifyPackage(verifyInput)).ok).toBe(true);
    expect(cache.get(cacheKeyFor("trust/v1", "rev/v1"))).toBeDefined();
    expect(cache.get(cacheKeyFor("trust/v2", "rev/v1"))).toBeUndefined();

    const second = await engineV2.verifyPackage(verifyInput);
    expect(second.ok).toBe(true);
    expect(cache.get(cacheKeyFor("trust/v2", "rev/v1"))).toBeDefined();
  });

  it("misses cache when revocation checkpoint changes", async () => {
    const cache = createMemoryVerificationCache();
    const evidenceStore = createMemoryEvidenceStore();
    await seedEvidenceArtifacts(evidenceStore);
    const engineA = buildEngine({
      cache,
      trustVersion: "trust/v1",
      revocationCheckpoint: "rev/checkpoint-a",
      evidenceStore,
    });
    const engineB = buildEngine({
      cache,
      trustVersion: "trust/v1",
      revocationCheckpoint: "rev/checkpoint-b",
      evidenceStore,
    });

    expect((await engineA.verifyPackage(verifyInput)).ok).toBe(true);
    expect(cache.get(cacheKeyFor("trust/v1", "rev/checkpoint-a"))).toBeDefined();
    expect(cache.get(cacheKeyFor("trust/v1", "rev/checkpoint-b"))).toBeUndefined();
    expect((await engineB.verifyPackage(verifyInput)).ok).toBe(true);
    expect(cache.get(cacheKeyFor("trust/v1", "rev/checkpoint-b"))).toBeDefined();
  });

  it("invalidateAll clears cached entries", async () => {
    const cache = createMemoryVerificationCache();
    const evidenceStore = createMemoryEvidenceStore();
    await seedEvidenceArtifacts(evidenceStore);
    const engine = buildEngine({
      cache,
      trustVersion: "trust/v1",
      revocationCheckpoint: "rev/v1",
      evidenceStore,
    });

    const key = cacheKeyFor("trust/v1", "rev/v1");

    expect((await engine.verifyPackage(verifyInput)).ok).toBe(true);
    expect(cache.get(key)).toBeDefined();
    cache.invalidateAll();
    expect(cache.get(key)).toBeUndefined();

    const second = await engine.verifyPackage(verifyInput);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(cache.get(key)).toBeDefined();
      expect(second.value.cacheKey).toBe(cacheKeyString(key));
    }
  });
});
