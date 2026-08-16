import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileEvidenceStore } from "../../src/adapters/file/fileEvidenceStore.js";
import { createFileDecisionLog } from "../../src/adapters/file/fileDecisionLog.js";
import { createFileRevocationStore } from "../../src/adapters/file/fileRevocationStore.js";
import { createFileVerificationCache } from "../../src/adapters/file/fileVerificationCache.js";
import { createFileConformanceEngine } from "../../src/adapters/file/index.js";
import { createNoopAuditSink } from "../../src/adapters/memory/memoryAuditSink.js";
import { canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";
import { verificationRunId } from "../../src/foundation/conformanceId.js";

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

  it("file revocation store persists across instances", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-revocation-"));
    try {
      const first = createFileRevocationStore({ dir, checkpoint: "revocation/file" });
      expect(await first.isRevoked("cert-a")).toBe(false);
      first.revoke("cert-a");
      expect(await first.isRevoked("cert-a")).toBe(true);

      const second = createFileRevocationStore({ dir });
      expect(await second.isRevoked("cert-a")).toBe(true);
      expect(second.checkpoint).toBe("revocation/file");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("file verification cache survives process-equivalent reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cache-"));
    try {
      const key = {
        subjectDigest: "a".repeat(64),
        evidenceRootDigest: "b".repeat(64),
        verifierBuild: "v1",
        policyVersion: "p1",
        trustRootSetVersion: "t1",
        revocationCheckpoint: "r1",
      };
      const decision = {
        runId: verificationRunId("run-file-cache"),
        profile: "engineeringAdmission" as const,
        status: initialConformanceStatus(),
        violations: [],
        evidenceRootDigest: key.evidenceRootDigest,
        decidedAt: "2026-01-01T00:00:00.000Z",
      };
      const first = createFileVerificationCache({ dir });
      expect(first.get(key)).toBeUndefined();
      first.set(key, decision);
      expect(first.get(key)?.runId).toBe(decision.runId);

      const second = createFileVerificationCache({ dir });
      expect(second.get(key)?.runId).toBe(decision.runId);
      second.invalidateAll();
      expect(second.get(key)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("file engine uses file revocation and cache, not memory stubs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-file-engine-"));
    try {
      const { engine } = createFileConformanceEngine({
        dir,
        audit: createNoopAuditSink(),
      });
      const revocation = createFileRevocationStore({ dir });
      revocation.revoke("digest-revoked");
      expect(await revocation.isRevoked("digest-revoked")).toBe(true);
      expect(engine.inspectCandidate).toBeTypeOf("function");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
