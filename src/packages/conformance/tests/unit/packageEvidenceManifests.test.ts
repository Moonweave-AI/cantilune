import { describe, it, expect } from "vitest";
import {
  allPackageEvidenceBundles,
  PRODUCTION_PACKAGES,
  buildPackageEvidenceBundle,
} from "../../src/evidence/packageEvidenceManifests.js";
import { createMemoryEvidenceStore } from "../../src/adapters/memory/memoryEvidenceStore.js";
import { createMemoryTrustStore } from "../../src/adapters/memory/memoryTrustStore.js";
import { createMemoryRevocationStore } from "../../src/adapters/memory/memoryRevocationStore.js";
import { createMemoryVerificationCache } from "../../src/adapters/memory/memoryVerificationCache.js";
import { createNoopAuditSink } from "../../src/adapters/memory/memoryAuditSink.js";
import { createConformanceEngine } from "../../src/engine/conformanceEngine.js";
import { canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";
import {
  recomputeFourProjectionSemanticsFromWorld,
  verifyFourProjectionsFromCommittedWorld,
} from "../../src/evidence/recomputeFromCommittedWorld.js";
import type { AdmissionSubject } from "../../src/subject/admissionSubject.js";

describe("package evidence manifests (14 production packages)", () => {
  it("covers all production package slugs", () => {
    expect(PRODUCTION_PACKAGES).toHaveLength(14);
    expect(allPackageEvidenceBundles()).toHaveLength(14);
  });

  it("verifyPackage accepts each package evidence bundle", async () => {
    for (const bundle of allPackageEvidenceBundles()) {
      const evidenceStore = createMemoryEvidenceStore();
      for (const digest of bundle.evidenceArtifactDigests) {
        const put = await evidenceStore.put(
          digest,
          canonicalJsonBytes({ artifactDigest: digest, package: bundle.packageName }),
        );
        expect(put.ok).toBe(true);
      }
      const engine = createConformanceEngine({
        evidenceStore,
        trustStore: createMemoryTrustStore(),
        revocationStore: createMemoryRevocationStore(),
        cache: createMemoryVerificationCache(),
        audit: createNoopAuditSink(),
      });
      const result = await engine.verifyPackage({
        manifest: bundle.manifest,
        inventory: bundle.inventory,
        observedRuleIds: [...bundle.observedRuleIds],
        evidenceArtifactDigests: [...bundle.evidenceArtifactDigests],
      });
      expect(result.ok, bundle.packageName).toBe(true);
    }
  });

  it("buildPackageEvidenceBundle is deterministic", () => {
    const a = buildPackageEvidenceBundle("core");
    const b = buildPackageEvidenceBundle("core");
    expect(a.manifest.evidenceRootDigest).toBe(b.manifest.evidenceRootDigest);
    expect(a.inventory.inventoryDigest).toBe(b.inventory.inventoryDigest);
  });
});

describe("C5 recompute from committed world", () => {
  const subject: AdmissionSubject = {
    admissionId: "adm-1",
    activationDomainId: "dom-1",
    fromEpochId: "e0",
    toEpochId: "e1",
    fromEpochOrdinal: 0,
    toEpochOrdinal: 1,
    extensionPlanDigest: "c".repeat(64),
    expectedRuntimeHead: "d".repeat(64),
    expectedBindingGeneration: 1,
    fromSchemaRef: { digest: "a".repeat(64) } as AdmissionSubject["fromSchemaRef"],
    toSchemaRef: { digest: "b".repeat(64) } as AdmissionSubject["toSchemaRef"],
  };

  it("recomputes digests from observability views", () => {
    const views = {
      dependency: { nodes: 1, edges: 0 },
      resource: { caps: [] },
      communication: { sessions: [] },
      structure: { bipartite: true },
      spine: { events: 2 },
    };
    const first = recomputeFourProjectionSemanticsFromWorld({ subject, views });
    const second = recomputeFourProjectionSemanticsFromWorld({ subject, views });
    expect(first.dag.digest).toBe(second.dag.digest);
    expect(first.petri.digest).toBe(second.petri.digest);

    const ok = verifyFourProjectionsFromCommittedWorld({
      subject,
      views,
      claimed: {
        dagDigest: first.dag.digest,
        petriDigest: first.petri.digest,
        piDigest: first.pi.digest,
        morphismDigest: first.morphism.digest,
      },
    });
    expect(ok.filter((v) => v.code === "digest_mismatch")).toHaveLength(0);

    const bad = verifyFourProjectionsFromCommittedWorld({
      subject,
      views,
      claimed: {
        dagDigest: "0".repeat(64) as never,
        petriDigest: first.petri.digest,
        piDigest: first.pi.digest,
        morphismDigest: first.morphism.digest,
      },
    });
    expect(bad.some((v) => v.code === "digest_mismatch")).toBe(true);
  });
});
