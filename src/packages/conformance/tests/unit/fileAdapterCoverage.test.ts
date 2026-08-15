import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileEvidenceStore } from "../../src/adapters/file/fileEvidenceStore.js";
import { createFileDecisionLog } from "../../src/adapters/file/fileDecisionLog.js";
import { canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";

describe("file adapter coverage", () => {
  it("file evidence store put/get/has and error paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cas-"));
    try {
      const store = createFileEvidenceStore({ dir });
      const digest = computeEvidenceDigest({ file: true }) as string;
      const bytes = canonicalJsonBytes({ file: true });

      await expect(store.put("bad-digest", bytes)).rejects.toThrow(/invalid content digest/);
      expect(await store.put(digest, bytes)).toMatchObject({ ok: true });
      expect(await store.put(digest, bytes)).toMatchObject({ ok: false });
      expect(await store.has(digest)).toBe(true);
      const got = await store.get(digest);
      expect(got.ok).toBe(true);
      expect(await store.get("f".repeat(64))).toMatchObject({ ok: false });

      const tampered = createFileEvidenceStore({ dir, verifyDigestOnPut: false });
      const wrongDigest = computeEvidenceDigest({ other: true }) as string;
      await tampered.put(wrongDigest, canonicalJsonBytes({ tampered: true }));
      expect(await tampered.get(wrongDigest)).toMatchObject({ ok: false });
      expect(await tampered.has(wrongDigest)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("file decision log append and replay chain", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-log-"));
    try {
      const log = createFileDecisionLog({ dir });
      const entry = {
        runId: "run-file-log",
        decisionDigest: computeEvidenceDigest({ log: 1 }) as string,
        profile: "engineeringAdmission",
        recordedAt: "2026-01-01T00:00:00.000Z",
      };
      const append = await log.append(entry);
      expect(append.ok).toBe(true);
      const all = await log.readAll();
      expect(all.ok).toBe(true);
      if (all.ok) {
        expect(all.value).toHaveLength(1);
      }

      const corruptDir = mkdtempSync(join(tmpdir(), "conformance-log-corrupt-"));
      try {
        writeFileSync(join(corruptDir, "decisions.jsonl"), "{bad json\n", "utf8");
        const corrupt = createFileDecisionLog({ dir: corruptDir });
        const badAll = await corrupt.readAll();
        expect(badAll.ok).toBe(false);
      } finally {
        rmSync(corruptDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
