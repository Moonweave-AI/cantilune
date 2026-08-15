import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileEvidenceStore } from "../../../src/adapters/file/fileEvidenceStore.js";
import { canonicalJsonBytes } from "../../../src/canonical/canonicalEncoding.js";
import { computeEvidenceDigest } from "../../../src/canonical/evidenceDigest.js";

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function casObjectPath(baseDir: string, digest: string): string {
  const aa = digest.slice(0, 2);
  const bb = digest.slice(2, 4);
  return join(baseDir, "cas", aa, bb, digest);
}

describe("L7 file CAS crash recovery", () => {
  it("survives process restart and reloads committed objects", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-crash-"));
    try {
      const storeA = createFileEvidenceStore({ dir });
      const payload = { evidence: "committed" };
      const bytes = canonicalJsonBytes(payload);
      const digest = computeEvidenceDigest(payload) as string;

      expect((await storeA.put(digest, bytes)).ok).toBe(true);

      const storeB = createFileEvidenceStore({ dir });
      expect(await storeB.has(digest)).toBe(true);
      const got = await storeB.get(digest);
      expect(got.ok).toBe(true);
      if (got.ok) {
        expect(Buffer.from(got.value).equals(Buffer.from(bytes))).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects overwrite after simulated crash left partial object path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-crash-partial-"));
    try {
      const bytes = canonicalJsonBytes({ partial: true });
      const digest = sha256Hex(bytes);
      const objectPath = casObjectPath(dir, digest);
      mkdirSync(join(objectPath, ".."), { recursive: true });

      writeFileSync(objectPath, Buffer.from(bytes.subarray(0, Math.max(1, bytes.length - 4))));

      const store = createFileEvidenceStore({ dir });
      expect(existsSync(objectPath)).toBe(true);
      const putAgain = await store.put(digest, bytes);
      expect(putAgain.ok).toBe(false);
      expect(await store.has(digest)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("continues accepting new digests when unrelated mid-write artifact exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-crash-unrelated-"));
    try {
      const corruptBytes = new Uint8Array([9, 9, 9]);
      const corruptDigest = sha256Hex(corruptBytes);
      const corruptPath = casObjectPath(dir, corruptDigest);
      mkdirSync(join(corruptPath, ".."), { recursive: true });
      writeFileSync(corruptPath, Buffer.from([9]));

      const store = createFileEvidenceStore({ dir });
      const goodBytes = canonicalJsonBytes({ ok: true });
      const goodDigest = computeEvidenceDigest({ ok: true }) as string;
      expect((await store.put(goodDigest, goodBytes)).ok).toBe(true);

      const recovered = createFileEvidenceStore({ dir });
      const loaded = await recovered.get(goodDigest);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(readFileSync(casObjectPath(dir, goodDigest)).equals(Buffer.from(goodBytes))).toBe(
          true,
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
