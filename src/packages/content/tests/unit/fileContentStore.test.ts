import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { contentRef } from "@cantilune/core";
import { createFileContentStore } from "../../src/adapters/file/index.js";
import { blobToText } from "../../src/contentStore.js";
import { extractHex, isSha256ContentRef } from "../../src/contentHasher.js";

describe("FileContentStore", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "cantilune-content-test-"));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("put returns a sha256 ContentRef", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("hello world");
    expect(isSha256ContentRef(ref as string)).toBe(true);
  });

  it("put is idempotent", async () => {
    const store = createFileContentStore(rootDir);
    const ref1 = await store.put("same content");
    const ref2 = await store.put("same content");
    expect(ref1).toBe(ref2);
  });

  it("get returns Uint8Array consistently", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("hello world", { mimeType: "text/plain" });
    const blob = await store.get(ref);
    expect(blob).toBeDefined();
    expect(blob!.bytes).toBeInstanceOf(Uint8Array);
    expect(blobToText(blob!)).toBe("hello world");
  });

  it("get returns Uint8Array even without text/ mimeType", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("code here"); // default: application/octet-stream
    const blob = await store.get(ref);
    expect(blob!.bytes).toBeInstanceOf(Uint8Array);
    expect(blobToText(blob!)).toBe("code here");
  });

  it("get returns undefined for unknown ref", async () => {
    const store = createFileContentStore(rootDir);
    const unknownRef = contentRef(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(await store.get(unknownRef)).toBeUndefined();
  });

  it("get returns undefined for non-sha256 ref format", async () => {
    const store = createFileContentStore(rootDir);
    const legacyRef = contentRef("content://task-T");
    expect(await store.get(legacyRef)).toBeUndefined();
  });

  it("exists works correctly", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("exists-test");
    expect(await store.exists(ref)).toBe(true);
    const unknown = contentRef(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(await store.exists(unknown)).toBe(false);
  });

  it("metadata returns correct values", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("meta-test", { createdBy: "tester", mimeType: "text/plain" });
    const meta = await store.metadata(ref);
    expect(meta).toBeDefined();
    expect(meta!.size).toBe(9); // "meta-test" = 9 bytes
    expect(meta!.mimeType).toBe("text/plain");
    expect(meta!.createdBy).toBe("tester");
    expect(meta!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("count tracks entries", async () => {
    const store = createFileContentStore(rootDir);
    expect(await store.count()).toBe(0);
    await store.put("a");
    await store.put("b");
    await store.put("a"); // dedup
    expect(await store.count()).toBe(2);
  });

  it("creates CAS directory layout", async () => {
    const store = createFileContentStore(rootDir);
    await store.put("layout-test");
    const prefixes = await readdir(rootDir);
    expect(prefixes).toHaveLength(1);
    expect(prefixes[0]).toHaveLength(2);
  });

  it("cross-instance read: second store reads what first wrote", async () => {
    const store1 = createFileContentStore(rootDir);
    const ref = await store1.put("cross-instance", { mimeType: "text/plain" });

    const store2 = createFileContentStore(rootDir);
    const blob = await store2.get(ref);
    expect(blob).toBeDefined();
    expect(blobToText(blob!)).toBe("cross-instance");
  });

  it("provides synchronous authoritative availability across restart", async () => {
    const writer = createFileContentStore(rootDir);
    const ref = await writer.put("durable-authority", { mimeType: "text/plain" });

    const restarted = createFileContentStore(rootDir);
    expect(restarted.isAvailable(ref)).toBe(true);
  });

  it("fails synchronous authority closed for missing or corrupt content", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("authority-corruption");
    const hex = extractHex(ref)!;
    await writeFile(join(rootDir, hex.slice(0, 2), `${hex}.blob`), "tampered");

    expect(store.isAvailable(ref)).toBe(false);
    expect(
      store.isAvailable(
        contentRef("sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"),
      ),
    ).toBe(false);
  });

  it("surfaces unexpected filesystem errors instead of treating them as absence", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("unexpected-io-error");
    const hex = extractHex(ref)!;
    const blobPath = join(rootDir, hex.slice(0, 2), `${hex}.blob`);
    await rm(blobPath);
    await mkdir(blobPath);

    expect(() => store.isAvailable(ref)).toThrow();
    await expect(store.get(ref)).rejects.toThrow();
  });

  it("fails synchronous authority closed for malformed metadata", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("authority-metadata");
    const hex = extractHex(ref)!;
    const metaPath = join(rootDir, hex.slice(0, 2), `${hex}.meta.json`);
    const size = new TextEncoder().encode("authority-metadata").length;
    const invalidMetadata: unknown[] = [
      null,
      { size: size + 1, mimeType: "text/plain", createdAt: "now" },
      { size, mimeType: "", createdAt: new Date().toISOString() },
      { size, mimeType: "text/plain", createdAt: "now" },
      { size, mimeType: 7, createdAt: "now" },
      { size, mimeType: "text/plain", createdAt: 7 },
      { size, mimeType: "text/plain", createdAt: "now", createdBy: 7 },
    ];

    for (const metadata of invalidMetadata) {
      await writeFile(metaPath, JSON.stringify(metadata));
      expect(store.isAvailable(ref)).toBe(false);
    }

    await writeFile(metaPath, "not-json");
    expect(store.isAvailable(ref)).toBe(false);
    expect(store.isAvailable(contentRef("content://not-a-cas-ref"))).toBe(false);
  });

  it("handles binary content", async () => {
    const store = createFileContentStore(rootDir);
    const binary = new Uint8Array([0x00, 0xff, 0x80, 0x01]);
    const ref = await store.put(binary);
    const blob = await store.get(ref);
    expect(blob!.bytes).toEqual(binary);
  });

  it("copies mutable binary input before the first asynchronous write", async () => {
    const store = createFileContentStore(rootDir);
    const input = new Uint8Array([1, 2, 3, 4]);
    const expected = new Uint8Array(input);

    const pending = store.put(input);
    input.fill(9);
    const ref = await pending;

    expect(store.isAvailable(ref)).toBe(true);
    expect((await store.get(ref))?.bytes).toEqual(expected);
  });

  it("handles large content (1MB)", async () => {
    const store = createFileContentStore(rootDir);
    const large = new Uint8Array(1024 * 1024).fill(99);
    const ref = await store.put(large);
    const blob = await store.get(ref);
    expect(blob!.bytes).toHaveLength(1024 * 1024);
  });

  it("rejects path-injection attempts in ref gracefully", async () => {
    const store = createFileContentStore(rootDir);
    const evil = contentRef("sha256:../../etc/passwd/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(await store.get(evil)).toBeUndefined();
    expect(await store.exists(evil)).toBe(false);
  });

  it("exists returns false for non-sha256 ref format", async () => {
    const store = createFileContentStore(rootDir);
    const legacyRef = contentRef("content://task-T");
    expect(await store.exists(legacyRef)).toBe(false);
  });

  it("metadata returns undefined for unknown sha256 ref", async () => {
    const store = createFileContentStore(rootDir);
    const unknownRef = contentRef(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(await store.metadata(unknownRef)).toBeUndefined();
  });

  it("metadata returns undefined for non-sha256 ref format", async () => {
    const store = createFileContentStore(rootDir);
    const legacyRef = contentRef("content://task-T");
    expect(await store.metadata(legacyRef)).toBeUndefined();
  });

  it("metadata throws when meta file contains invalid JSON", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("json-meta-test");
    const hex = extractHex(ref)!;
    const metaPath = join(rootDir, hex.slice(0, 2), `${hex}.meta.json`);
    await writeFile(metaPath, "not-json");
    await expect(store.metadata(ref)).rejects.toThrow();
  });

  it("get throws when stored blob hash does not match ref", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("corruption-test");
    const hex = extractHex(ref)!;
    const blobPath = join(rootDir, hex.slice(0, 2), `${hex}.blob`);
    await writeFile(blobPath, "tampered content");
    await expect(store.get(ref)).rejects.toThrow("corruption detected");
  });

  it("put never replaces existing CAS bytes that disagree with the hash path", async () => {
    const store = createFileContentStore(rootDir);
    const body = "immutable";
    const ref = await store.put(body);
    const hex = extractHex(ref)!;
    const blobPath = join(rootDir, hex.slice(0, 2), `${hex}.blob`);

    await writeFile(blobPath, "xxxxxxxxx");
    await expect(store.put(body)).rejects.toThrow("existing blob bytes differ");

    await writeFile(blobPath, "different-length");
    await expect(store.put(body)).rejects.toThrow("existing blob bytes differ");
  });

  it("get throws when meta file contains invalid JSON", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("json-get-test");
    const hex = extractHex(ref)!;
    const metaPath = join(rootDir, hex.slice(0, 2), `${hex}.meta.json`);
    await writeFile(metaPath, "{ invalid");
    await expect(store.get(ref)).rejects.toThrow();
  });

  it("get and metadata reject structurally invalid metadata", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("invalid-structured-meta");
    const hex = extractHex(ref)!;
    const metaPath = join(rootDir, hex.slice(0, 2), `${hex}.meta.json`);
    await writeFile(
      metaPath,
      JSON.stringify({
        size: 1,
        mimeType: "text/plain",
        createdAt: "now",
      }),
    );

    await expect(store.get(ref)).rejects.toThrow("stored metadata is invalid");
    await expect(store.metadata(ref)).rejects.toThrow("stored metadata is invalid");
  });

  it("count returns 0 when root directory does not exist", async () => {
    const missingRoot = join(rootDir, "missing-store-root");
    const store = createFileContentStore(missingRoot);
    expect(await store.count()).toBe(0);
  });

  it("count surfaces a non-directory store root", async () => {
    const fileRoot = join(rootDir, "not-a-directory");
    await writeFile(fileRoot, "occupied");
    await expect(createFileContentStore(fileRoot).count()).rejects.toThrow();
  });

  it("count ignores non-hex prefix directories", async () => {
    const store = createFileContentStore(rootDir);
    await store.put("counted");
    await mkdir(join(rootDir, "junk"), { recursive: true });
    await mkdir(join(rootDir, "abc"), { recursive: true });
    expect(await store.count()).toBe(1);
  });

  it("list enumerates stored entries with their metadata", async () => {
    const store = createFileContentStore(rootDir);
    const ref1 = await store.put("entry-one", { mimeType: "text/plain", createdBy: "a" });
    const ref2 = await store.put("entry-two");

    const entries = await store.list();
    expect(entries).toHaveLength(2);
    const byRef = new Map(entries.map((e) => [e.ref, e.metadata]));
    expect(byRef.has(ref1)).toBe(true);
    expect(byRef.has(ref2)).toBe(true);
    expect(byRef.get(ref1)?.mimeType).toBe("text/plain");
    expect(byRef.get(ref1)?.createdBy).toBe("a");
    expect(byRef.get(ref2)?.size).toBe(new TextEncoder().encode("entry-two").length);
  });

  it("list returns empty when the store root does not exist", async () => {
    const store = createFileContentStore(join(rootDir, "no-such-root"));
    expect(await store.list()).toEqual([]);
  });

  it("list skips blobs whose metadata is missing or corrupt", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("has-meta");
    const orphan = await store.put("no-meta");
    const orphanHex = extractHex(orphan)!;
    const orphanMeta = join(rootDir, orphanHex.slice(0, 2), `${orphanHex}.meta.json`);
    await rm(orphanMeta);

    const entries = await store.list();
    const refs = entries.map((e) => e.ref);
    expect(refs).toContain(ref);
    expect(refs).not.toContain(orphan);
  });

  it("list ignores non-hex prefix directories and non-blob files", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("real");
    await mkdir(join(rootDir, "zz"), { recursive: true });
    await writeFile(join(rootDir, "zz", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef.blob"), "x");
    await mkdir(join(rootDir, "ab"), { recursive: true });
    await writeFile(join(rootDir, "ab", "not-a-blob.txt"), "noise");

    const entries = await store.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.ref).toBe(ref);
  });

  it("remove deletes the blob and its metadata", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("to-remove");
    expect(await store.exists(ref)).toBe(true);

    const removed = await store.remove(ref);
    expect(removed).toBe(true);
    expect(await store.exists(ref)).toBe(false);
    expect(await store.get(ref)).toBeUndefined();
    expect(await store.count()).toBe(0);
  });

  it("remove also clears a stale repair claim", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("claimed");
    const hex = extractHex(ref)!;
    const metaPath = join(rootDir, hex.slice(0, 2), `${hex}.meta.json`);
    const claimPath = `${metaPath}.repair.claim`;
    await writeFile(claimPath, "{}");

    expect(await store.remove(ref)).toBe(true);
    expect(await readdir(join(rootDir, hex.slice(0, 2)))).not.toContain(
      `${hex}.meta.json.repair.claim`,
    );
  });

  it("remove returns false for an unknown ref and leaves nothing changed", async () => {
    const store = createFileContentStore(rootDir);
    await store.put("stays");
    const unknown = contentRef(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(await store.remove(unknown)).toBe(false);
    expect(await store.count()).toBe(1);
  });

  it("remove returns false for a non-sha256 ref", async () => {
    const store = createFileContentStore(rootDir);
    await store.put("stays");
    expect(await store.remove(contentRef("content://task-T"))).toBe(false);
    expect(await store.count()).toBe(1);
  });

  it("list rethrows a non-ENOENT, non-SyntaxError corruption from a stored blob", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("corrupt-meta");
    const hex = extractHex(ref)!;
    const dir = join(rootDir, hex.slice(0, 2));
    const metaPath = join(dir, `${hex}.meta.json`);
    // Valid JSON but an invalid metadata shape: parseStoredMetadata throws a
    // non-SyntaxError corruption Error, which list must rethrow (not skip).
    await writeFile(metaPath, JSON.stringify({ size: 999, mimeType: "text/plain", createdAt: "not-iso" }));

    await expect(store.list()).rejects.toThrow("stored metadata is invalid");
  });

  it("list rethrows a non-ENOENT error from a non-directory store root", async () => {
    const fileRoot = join(rootDir, "not-a-directory-list");
    await writeFile(fileRoot, "occupied");
    await expect(createFileContentStore(fileRoot).list()).rejects.toThrow();
  });

  it("second put of same content skips exclusive meta write (EEXIST path)", async () => {
    const store = createFileContentStore(rootDir);
    const ref1 = await store.put("duplicate-meta", { mimeType: "text/plain", createdBy: "first" });
    const ref2 = await store.put("duplicate-meta", { mimeType: "text/html", createdBy: "second" });
    expect(ref2).toBe(ref1);
    const meta = await store.metadata(ref1);
    expect(meta!.mimeType).toBe("text/plain");
    expect(meta!.createdBy).toBe("first");
  });

  it("repairs an empty metadata target left by an interrupted legacy writer", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("recover-meta", { mimeType: "text/plain", createdBy: "first" });
    const hex = extractHex(ref)!;
    const metaPath = join(rootDir, hex.slice(0, 2), `${hex}.meta.json`);

    // This is the exact durable residue of the former open("wx") -> rename
    // crash window: the target exists, but the complete temp file was never
    // renamed over the zero-byte placeholder.
    await writeFile(metaPath, "");
    expect(store.isAvailable(ref)).toBe(false);

    const retried = await store.put("recover-meta", {
      mimeType: "application/recovered",
      createdBy: "repairer",
    });

    expect(retried).toBe(ref);
    expect(store.isAvailable(ref)).toBe(true);
    expect(blobToText((await store.get(ref))!)).toBe("recover-meta");
    expect(await store.metadata(ref)).toMatchObject({
      size: 12,
      mimeType: "application/recovered",
      createdBy: "repairer",
    });
  });

  it("publishes one complete repair claim without changing its provenance", async () => {
    const store = createFileContentStore(rootDir);
    const body = "claimed-repair";
    const ref = await store.put(body, { mimeType: "text/plain", createdBy: "legacy" });
    const hex = extractHex(ref)!;
    const dir = join(rootDir, hex.slice(0, 2));
    const metaPath = join(dir, `${hex}.meta.json`);
    const claimPath = `${metaPath}.repair.claim`;
    const winner = {
      size: new TextEncoder().encode(body).length,
      mimeType: "application/winner",
      createdAt: "2026-08-13T00:00:00.000Z",
      createdBy: "repair-winner",
    };

    // Deterministic residue of a repairer that durably claimed its candidate
    // and stopped before rename. A different contender must help this claim
    // complete instead of replacing its audit provenance.
    await writeFile(metaPath, "");
    await writeFile(claimPath, JSON.stringify(winner));

    await store.put(body, {
      mimeType: "application/loser",
      createdBy: "repair-loser",
    });

    expect(await store.metadata(ref)).toEqual(winner);
    expect(await readdir(dir)).not.toContain(`${hex}.meta.json.repair.claim`);

    await store.put(body, { mimeType: "application/late", createdBy: "late-writer" });
    expect(await store.metadata(ref)).toEqual(winner);
  });

  it("fails closed instead of replacing an invalid persisted repair claim", async () => {
    const store = createFileContentStore(rootDir);
    const body = "invalid-repair-claim";
    const ref = await store.put(body);
    const hex = extractHex(ref)!;
    const dir = join(rootDir, hex.slice(0, 2));
    const metaPath = join(dir, `${hex}.meta.json`);
    const claimPath = `${metaPath}.repair.claim`;

    await writeFile(metaPath, "");
    await writeFile(claimPath, "not-valid-json");

    await expect(
      store.put(body, { mimeType: "application/new", createdBy: "new-repairer" }),
    ).rejects.toThrow("metadata repair claim is missing or invalid");
    expect(await readFile(claimPath, "utf8")).toBe("not-valid-json");
    expect(store.isAvailable(ref)).toBe(false);
  });

  it("does not conceal an unexpected metadata publication error", async () => {
    const store = createFileContentStore(rootDir);
    const ref = await store.put("metadata-io-error");
    const hex = extractHex(ref)!;
    const metaPath = join(rootDir, hex.slice(0, 2), `${hex}.meta.json`);
    await rm(metaPath);
    await mkdir(metaPath);

    await expect(store.put("metadata-io-error")).rejects.toThrow();
  });
});
