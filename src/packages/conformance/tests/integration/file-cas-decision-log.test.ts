import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { createFileEvidenceStore } from "../../src/adapters/file/fileEvidenceStore.js";
import { createFileDecisionLog } from "../../src/adapters/file/fileDecisionLog.js";
import { createFileConformanceEngine } from "../../src/adapters/file/index.js";
import { createNoopAuditSink } from "../../src/adapters/memory/memoryAuditSink.js";
import { createHash } from "node:crypto";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { canonicalJsonBytes } from "../../src/canonical/canonicalEncoding.js";

function sha256Digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("file CAS + decision log integration", () => {
  let dir: string;

  afterEach(() => {
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores and retrieves content by digest", async () => {
    dir = mkdtempSync(join(tmpdir(), "conformance-cas-"));
    const store = createFileEvidenceStore({ dir });
    const bytes = canonicalJsonBytes({ evidence: true });
    const digest = computeEvidenceDigest({ evidence: true }) as string;

    const put = await store.put(digest, bytes);
    expect(put.ok).toBe(true);

    const got = await store.get(digest);
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(Buffer.from(got.value).equals(Buffer.from(bytes))).toBe(true);
    }
    expect(await store.has(digest)).toBe(true);
  });

  it("rejects overwrite on put", async () => {
    dir = mkdtempSync(join(tmpdir(), "conformance-cas-"));
    const store = createFileEvidenceStore({ dir });
    const bytes = new Uint8Array([1, 2, 3]);
    const digest = sha256Digest(bytes);

    expect((await store.put(digest, bytes)).ok).toBe(true);
    expect((await store.put(digest, bytes)).ok).toBe(false);
  });

  it("rejects invalid digest paths (traversal-safe)", async () => {
    dir = mkdtempSync(join(tmpdir(), "conformance-cas-"));
    const store = createFileEvidenceStore({ dir });
    const bytes = new Uint8Array([9]);

    await expect(store.put("../escape", bytes)).rejects.toThrow(/invalid content digest/);
    await expect(store.get("not-a-digest")).rejects.toThrow(/invalid content digest/);
  });

  it("appends decision log entries in order", async () => {
    dir = mkdtempSync(join(tmpdir(), "conformance-decision-"));
    const log = createFileDecisionLog({ dir });

    const first = await log.append({
      runId: "run-1",
      decisionDigest: "a".repeat(64),
      profile: "engineeringAdmission",
      recordedAt: "2026-01-01T00:00:00.000Z",
    });
    const second = await log.append({
      runId: "run-2",
      decisionDigest: "b".repeat(64),
      profile: "fourProjection",
      recordedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.sequence).toBe(1);
      expect(second.value.sequence).toBe(2);
      expect(first.value.entryDigest).toMatch(/^[a-f0-9]{64}$/);
    }

    const all = await log.readAll();
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value).toHaveLength(2);
      expect(all.value[1]?.runId).toBe("run-2");
    }
  });

  it("wires createFileConformanceEngine with shared dir", async () => {
    dir = mkdtempSync(join(tmpdir(), "conformance-engine-"));
    const { engine, evidenceStore, decisionLog } = createFileConformanceEngine({
      dir,
      audit: createNoopAuditSink(),
    });

    expect(engine.inspectCandidate).toBeTypeOf("function");
    expect(evidenceStore.has).toBeTypeOf("function");
    expect(decisionLog.append).toBeTypeOf("function");
  });
});
