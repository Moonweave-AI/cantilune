import { describe, expect, it } from "vitest";
import { verifyPackageEvidence } from "../../src/verifier/packageVerifier.js";
import {
  createMemoryEvidenceStore,
  createMemoryRevocationStore,
  createMemoryTrustStore,
} from "../../src/adapters/memory/index.js";
import { DEFAULT_VERIFICATION_POLICY } from "../../src/policy/verificationPolicy.js";
import {
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
} from "../support/conformanceFixtures.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";

describe("packageVerifier", () => {
  it("rejects empty inventory and missing artifacts", async () => {
    const violations = await verifyPackageEvidence(
      {
        manifest: sampleManifest(),
        inventory: sampleInventory({ entries: [] }),
        observedRuleIds: [...SAMPLE_OBSERVED],
        evidenceArtifactDigests: [],
      },
      {
        evidenceStore: createMemoryEvidenceStore(),
        trustStore: createMemoryTrustStore(),
        revocationStore: createMemoryRevocationStore(),
        policy: DEFAULT_VERIFICATION_POLICY,
      },
    );
    expect(violations.length).toBeGreaterThan(0);
    expect(
      violations.some((v) => v.code === "missing_evidence" || v.code === "inventory_incomplete"),
    ).toBe(true);
  });

  it("rejects invalid artifact digest format", async () => {
    const violations = await verifyPackageEvidence(
      {
        manifest: sampleManifest(),
        inventory: sampleInventory(),
        observedRuleIds: [...SAMPLE_OBSERVED],
        evidenceArtifactDigests: ["not-a-digest"],
      },
      {
        evidenceStore: createMemoryEvidenceStore(),
        trustStore: createMemoryTrustStore(),
        revocationStore: createMemoryRevocationStore(),
        policy: DEFAULT_VERIFICATION_POLICY,
      },
    );
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });

  it("rejects tampered inventory digest", async () => {
    const violations = await verifyPackageEvidence(
      {
        manifest: sampleManifest(),
        inventory: sampleInventory({
          inventoryDigest: computeEvidenceDigest({ tampered: true }) as string,
        }),
        observedRuleIds: [...SAMPLE_OBSERVED],
        evidenceArtifactDigests: [computeEvidenceDigest({ artifact: true }) as string],
      },
      {
        evidenceStore: createMemoryEvidenceStore(),
        trustStore: createMemoryTrustStore(),
        revocationStore: createMemoryRevocationStore(),
        policy: DEFAULT_VERIFICATION_POLICY,
      },
    );
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });
});
