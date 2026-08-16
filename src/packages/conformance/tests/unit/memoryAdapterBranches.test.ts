import { describe, expect, it } from "vitest";
import { createMemoryEvidenceStore } from "../../src/adapters/memory/memoryEvidenceStore.js";
import { createTestReviewerTrustStore } from "../../src/testing/testReviewerTrustStore.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";

describe("memory adapter branches", () => {
  it("memory evidence store get not_found", async () => {
    const store = createMemoryEvidenceStore();
    expect(await store.get(computeEvidenceDigest({ missing: true }) as string)).toMatchObject({
      ok: false,
    });
  });

  it("test reviewer trust store returns empty for other scopes", () => {
    const store = createTestReviewerTrustStore([]);
    expect(store.getRoots("other-scope")).toEqual([]);
  });
});
