import { describe, it, expect } from "vitest";
import { contentRef } from "@cantilune/core";
import { createMemoryContentStore } from "../../src/adapters/memory/index.js";
import { createContentHasher, isSha256ContentRef, extractHex } from "../../src/contentHasher.js";
import { blobToText } from "../../src/contentStore.js";

describe("MemoryContentStore", () => {
  it("put returns a sha256 ContentRef", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("hello world");
    expect(isSha256ContentRef(ref as string)).toBe(true);
  });

  it("put is idempotent — same content same ref", async () => {
    const store = createMemoryContentStore();
    const ref1 = await store.put("same content");
    const ref2 = await store.put("same content");
    expect(ref1).toBe(ref2);
  });

  it("string and Uint8Array of same bytes produce same ref", async () => {
    const store = createMemoryContentStore();
    const text = "hello";
    const bytes = new TextEncoder().encode(text);
    const ref1 = await store.put(text);
    const ref2 = await store.put(bytes);
    expect(ref1).toBe(ref2);
  });

  it("get returns Uint8Array for string input", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("hello world", { mimeType: "text/plain" });
    const blob = await store.get(ref);
    expect(blob).toBeDefined();
    expect(blob!.bytes).toBeInstanceOf(Uint8Array);
    expect(blobToText(blob!)).toBe("hello world");
    expect(blob!.metadata.mimeType).toBe("text/plain");
  });

  it("get returns Uint8Array for Uint8Array input", async () => {
    const store = createMemoryContentStore();
    const input = new Uint8Array([0x01, 0x02, 0x03]);
    const ref = await store.put(input);
    const blob = await store.get(ref);
    expect(blob).toBeDefined();
    expect(blob!.bytes).toBeInstanceOf(Uint8Array);
    expect(blob!.bytes).toEqual(input);
  });

  it("get returns undefined for unknown ref", async () => {
    const store = createMemoryContentStore();
    const unknownRef = contentRef(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(await store.get(unknownRef)).toBeUndefined();
  });

  it("get returns undefined for non-sha256 ref format", async () => {
    const store = createMemoryContentStore();
    const legacyRef = contentRef("content://task-T");
    expect(await store.get(legacyRef)).toBeUndefined();
  });

  it("exists returns true after put, false for unknown", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("test");
    expect(await store.exists(ref)).toBe(true);
    const unknown = contentRef(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(await store.exists(unknown)).toBe(false);
  });

  it("uses the same store instance as a synchronous commit authority", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("commit-authority");
    const unknown = contentRef(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );

    expect(store.isAvailable(ref)).toBe(true);
    expect(store.isAvailable(unknown)).toBe(false);
  });

  it("copies caller-owned bytes before storing authoritative CAS state", async () => {
    const store = createMemoryContentStore();
    const input = new Uint8Array([1, 2, 3, 4]);
    const expected = new Uint8Array(input);
    const ref = await store.put(input);

    input.fill(9);

    expect((await store.get(ref))?.bytes).toEqual(expected);
    expect(store.isAvailable(ref)).toBe(true);
  });

  it("returns byte copies so a reader cannot mutate authoritative CAS state", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put(new Uint8Array([5, 6, 7]));
    const first = await store.get(ref);
    first?.bytes.fill(0);

    expect((await store.get(ref))?.bytes).toEqual(new Uint8Array([5, 6, 7]));
    expect(store.isAvailable(ref)).toBe(true);
  });

  it("returns metadata copies and keeps availability metadata authoritative", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("metadata-boundary", {
      mimeType: "text/plain",
      createdBy: "agent-a",
    });
    const fromGet = await store.get(ref);
    const fromMetadata = await store.metadata(ref);

    Object.assign(fromGet?.metadata ?? {}, { size: -1, mimeType: 7 });
    Object.assign(fromMetadata ?? {}, { createdAt: 7, createdBy: 7 });

    expect((await store.get(ref))?.metadata).toMatchObject({
      size: new TextEncoder().encode("metadata-boundary").length,
      mimeType: "text/plain",
      createdBy: "agent-a",
    });
    expect(store.isAvailable(ref)).toBe(true);
    expect(store.isAvailable(contentRef("content://invalid"))).toBe(false);
  });

  it("metadata returns stored metadata with createdBy", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("data", { createdBy: "agent-1" });
    const meta = await store.metadata(ref);
    expect(meta).toBeDefined();
    expect(meta!.createdBy).toBe("agent-1");
    expect(meta!.size).toBe(4); // "data" = 4 bytes
  });

  it("metadata returns undefined createdBy when not provided", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("data");
    const meta = await store.metadata(ref);
    expect(meta).toBeDefined();
    expect(meta!.createdBy).toBeUndefined();
    expect(meta!.mimeType).toBe("application/octet-stream");
  });

  it("metadata.createdAt is ISO 8601 format", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("test");
    const meta = await store.metadata(ref);
    expect(meta!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it("count tracks number of stored entries", async () => {
    const store = createMemoryContentStore();
    expect(await store.count()).toBe(0);
    await store.put("a");
    expect(await store.count()).toBe(1);
    await store.put("b");
    expect(await store.count()).toBe(2);
    await store.put("a"); // dedup
    expect(await store.count()).toBe(2);
  });

  it("list enumerates stored entries with copied metadata", async () => {
    const store = createMemoryContentStore();
    const ref1 = await store.put("alpha", { mimeType: "text/plain", createdBy: "x" });
    const ref2 = await store.put("beta");

    const entries = await store.list();
    expect(entries).toHaveLength(2);
    const byRef = new Map(entries.map((e) => [e.ref, e.metadata]));
    expect(byRef.has(ref1)).toBe(true);
    expect(byRef.has(ref2)).toBe(true);
    expect(byRef.get(ref1)?.mimeType).toBe("text/plain");
    expect(byRef.get(ref1)?.createdBy).toBe("x");
    expect(byRef.get(ref2)?.size).toBe(4); // "beta"
  });

  it("list returns metadata copies that cannot mutate authoritative state", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("copy-guard");
    const entries = await store.list();
    const listed = entries.find((e) => e.ref === ref);
    expect(listed).toBeDefined();
    Object.assign(listed!.metadata, { size: -1 });
    expect((await store.list()).find((e) => e.ref === ref)?.metadata.size).toBe(
      new TextEncoder().encode("copy-guard").length,
    );
    expect(store.isAvailable(ref)).toBe(true);
  });

  it("list returns empty for a fresh store", async () => {
    const store = createMemoryContentStore();
    expect(await store.list()).toEqual([]);
  });

  it("remove deletes a stored entry and returns true", async () => {
    const store = createMemoryContentStore();
    const ref = await store.put("gone");
    expect(await store.remove(ref)).toBe(true);
    expect(await store.exists(ref)).toBe(false);
    expect(await store.count()).toBe(0);
  });

  it("remove returns false for an unknown ref", async () => {
    const store = createMemoryContentStore();
    const unknown = contentRef(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(await store.remove(unknown)).toBe(false);
  });

  it("remove returns false for a non-sha256 ref", async () => {
    const store = createMemoryContentStore();
    expect(await store.remove(contentRef("content://task-T"))).toBe(false);
  });

  it("remove leaves siblings untouched", async () => {
    const store = createMemoryContentStore();
    const keep = await store.put("keep");
    const drop = await store.put("drop");
    expect(await store.remove(drop)).toBe(true);
    expect(await store.exists(keep)).toBe(true);
    expect(await store.count()).toBe(1);
  });

  it("handles large content (1MB)", async () => {
    const store = createMemoryContentStore();
    const large = new Uint8Array(1024 * 1024).fill(42);
    const ref = await store.put(large);
    const blob = await store.get(ref);
    expect(blob!.bytes).toHaveLength(1024 * 1024);
    expect(blob!.metadata.size).toBe(1024 * 1024);
  });
});

describe("createContentHasher", () => {
  it("produces consistent hash for same input", () => {
    const hasher = createContentHasher();
    const ref1 = hasher("hello");
    const ref2 = hasher("hello");
    expect(ref1).toBe(ref2);
  });

  it("produces different hash for different input", () => {
    const hasher = createContentHasher();
    const ref1 = hasher("hello");
    const ref2 = hasher("world");
    expect(ref1).not.toBe(ref2);
  });

  it("string and equivalent bytes produce same hash", () => {
    const hasher = createContentHasher();
    const ref1 = hasher("hello");
    const ref2 = hasher(new TextEncoder().encode("hello"));
    expect(ref1).toBe(ref2);
  });
});

describe("isSha256ContentRef", () => {
  it("returns true for valid sha256 ref", () => {
    expect(
      isSha256ContentRef("sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"),
    ).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isSha256ContentRef("")).toBe(false);
  });

  it("returns false for non-sha256 prefix", () => {
    expect(isSha256ContentRef("content://task-T")).toBe(false);
    expect(isSha256ContentRef("md5:abcdef0123456789")).toBe(false);
  });

  it("returns false for wrong length hex", () => {
    expect(isSha256ContentRef("sha256:abcdef")).toBe(false);
    expect(
      isSha256ContentRef("sha256:zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"),
    ).toBe(false);
  });

  it("returns false for correct length but wrong prefix", () => {
    expect(isSha256ContentRef(`sha257:${"a".repeat(64)}`)).toBe(false);
  });

  it("returns false for uppercase hex", () => {
    expect(
      isSha256ContentRef("sha256:2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824"),
    ).toBe(false);
  });
});

describe("extractHex", () => {
  it("extracts hex from valid ref", () => {
    const ref = contentRef(
      "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(extractHex(ref)).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("returns undefined for invalid ref", () => {
    expect(extractHex(contentRef("content://task-T"))).toBeUndefined();
    expect(extractHex(contentRef(""))).toBeUndefined();
  });
});
