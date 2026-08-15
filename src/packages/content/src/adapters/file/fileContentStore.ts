import { join } from "node:path";
import { readFileSync } from "node:fs";
import { link, mkdir, open, readFile, stat, rename, readdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { ContentRef } from "@cantilune/core";
import type {
  ContentStore,
  ContentBlob,
  ContentEntry,
  ContentMetadata,
  ContentPutOptions,
} from "../../contentStore.js";
import { isContentMetadata, toBytes } from "../../contentStore.js";
import { createContentHasher, isSha256ContentRef } from "../../contentHasher.js";

const HEX_CHAR = /^[0-9a-f]+$/;

async function atomicWriteBlob(targetPath: string, data: Uint8Array): Promise<void> {
  const dir = join(targetPath, "..");
  const tmpPath = join(dir, `.tmp-${randomUUID()}`);
  await durableTempWrite(tmpPath, data);
  try {
    try {
      // Content is immutable by hash. Publish the complete inode once instead
      // of asking concurrent Windows writers to replace an existing file.
      await link(tmpPath, targetPath);
      await syncDirectory(dir);
      return;
    } catch (error: unknown) {
      if (!isEexist(error)) throw error;
    }

    const existing = new Uint8Array(await readFile(targetPath));
    if (!bytesEqual(existing, data)) {
      throw new Error(`[content] corruption detected: existing blob bytes differ: ${targetPath}`);
    }
  } finally {
    await unlink(tmpPath).catch(() => undefined);
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

async function durableTempWrite(path: string, data: string | Uint8Array): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(path).catch(() => undefined);
    throw error;
  }
  try {
    await handle.close();
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
}

async function syncDirectory(path: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, "r");
  } catch {
    return;
  }
  try {
    await handle.sync();
  } catch {
    // Directory fsync is unavailable on Windows. The content file itself has
    // still been flushed before publication.
  } finally {
    await handle.close();
  }
}

async function storedMetadataIsValid(targetPath: string, byteLength: number): Promise<boolean> {
  try {
    const value = JSON.parse(await readFile(targetPath, "utf8")) as unknown;
    return isContentMetadata(value, byteLength);
  } catch (error) {
    if (isEnoent(error) || error instanceof SyntaxError) return false;
    throw error;
  }
}

async function exclusiveWriteMeta(
  targetPath: string,
  data: string,
  byteLength: number,
): Promise<boolean> {
  const dir = join(targetPath, "..");
  const tmpPath = join(dir, `.tmp-meta-${randomUUID()}`);
  await durableTempWrite(tmpPath, data);
  try {
    // A hard link publishes the already-complete temporary inode in one
    // filesystem operation. Unlike open("wx") followed by rename, it never
    // leaves an empty target if the process dies between those two calls.
    try {
      await link(tmpPath, targetPath);
      await syncDirectory(dir);
      return true;
    } catch (err: unknown) {
      if (!isEexist(err)) throw err;
    }

    if (await storedMetadataIsValid(targetPath, byteLength)) return false;

    // A fixed claim path elects exactly one complete repair candidate. Every
    // contender either creates this hard link or helps publish the same inode;
    // no contender can replace another contender's already-valid metadata.
    // If the claimant crashes, a later put can finish the durable rename.
    const claimPath = `${targetPath}.repair.claim`;
    try {
      await link(tmpPath, claimPath);
      await syncDirectory(dir);
    } catch (err: unknown) {
      if (!isEexist(err)) throw err;
    }

    return publishMetadataRepairClaim(targetPath, claimPath, byteLength);
  } finally {
    await unlink(tmpPath).catch(() => undefined);
  }
}

async function publishMetadataRepairClaim(
  targetPath: string,
  claimPath: string,
  byteLength: number,
): Promise<boolean> {
  const dir = join(targetPath, "..");

  if (!(await storedMetadataIsValid(claimPath, byteLength))) {
    // The claim can disappear only when another repairer atomically renames it
    // into the target. Re-check before classifying a persisted bad claim as
    // corruption.
    if (await storedMetadataIsValid(targetPath, byteLength)) {
      await unlinkIfPresent(claimPath);
      return false;
    }
    throw new Error(`[content] metadata repair claim is missing or invalid: ${claimPath}`);
  }

  // A contender may have created a new claim after another contender already
  // published the winner. Re-check after reading the claim so it never
  // overwrites established metadata.
  if (await storedMetadataIsValid(targetPath, byteLength)) {
    await unlinkIfPresent(claimPath);
    return false;
  }

  let renamed = false;
  let lastRenameError: unknown = new Error("metadata repair rename was not attempted");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await storedMetadataIsValid(targetPath, byteLength)) return false;
    try {
      // The claim is a hard link to an already-written and fsynced candidate.
      // rename replaces the legacy invalid target atomically, so there is no
      // empty-target crash window.
      await rename(claimPath, targetPath);
      await syncDirectory(dir);
      renamed = true;
      break;
    } catch (err: unknown) {
      // Windows can transiently report EPERM while another process reads the
      // target or claim. Retry the fixed claim, but accept a failed rename only
      // after the canonical target validates as another contender's commit.
      if (await storedMetadataIsValid(targetPath, byteLength)) return false;
      lastRenameError = err;
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
    }
  }

  if (!renamed) throw lastRenameError;

  if (!(await storedMetadataIsValid(targetPath, byteLength))) {
    throw new Error(`[content] metadata repair published invalid metadata: ${targetPath}`);
  }
  return true;
}

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (err: unknown) {
    if (!isEnoent(err)) throw err;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err: unknown) {
    if (isEnoent(err)) return false;
    throw err;
  }
}

/**
 * File-based content-addressed store.
 *
 * Layout: `<rootDir>/<first 2 hex chars>/<full 64-char hash>.blob`
 *         `<rootDir>/<first 2 hex chars>/<full 64-char hash>.meta.json`
 *
 * Write safety:
 * - Atomic: write and fsync a temp inode, then publish by hard link
 * - TOCTOU-safe: the first complete blob wins and later writers verify bytes;
 *   meta atomically links a complete temp file for first-writer-wins; repair
 *   contenders elect one complete claim before healing legacy invalid metadata
 * - get() re-hashes blob on read to detect corruption
 *
 * Environment: Node.js only (node:fs, node:crypto).
 */
export function createFileContentStore(rootDir: string): ContentStore {
  const hasher = createContentHasher();

  function refToPaths(ref: ContentRef): { dir: string; blobPath: string; metaPath: string } {
    // Every caller either validates the sha256 format first or passes the
    // package-owned SHA-256 hasher result, so re-validating here would create a
    // second, unreachable interpretation of the same boundary.
    const hex = (ref as string).slice("sha256:".length);
    const prefix = hex.slice(0, 2);
    const dir = join(rootDir, prefix);
    return {
      dir,
      blobPath: join(dir, `${hex}.blob`),
      metaPath: join(dir, `${hex}.meta.json`),
    };
  }

  return {
    isAvailable(ref: ContentRef): boolean {
      if (!isSha256ContentRef(ref as string)) return false;
      const paths = refToPaths(ref);

      try {
        const bytes = new Uint8Array(readFileSync(paths.blobPath));
        if (hasher(bytes) !== ref) return false;

        const metadata = JSON.parse(readFileSync(paths.metaPath, "utf8")) as unknown;
        return isContentMetadata(metadata, bytes.length);
      } catch (error) {
        if (isEnoent(error) || error instanceof SyntaxError) return false;
        throw error;
      }
    },

    async put(content: string | Uint8Array, options?: ContentPutOptions): Promise<ContentRef> {
      // Detach from caller-owned mutable buffers before hashing. put() yields
      // during directory creation, so retaining the input alias could write
      // different bytes under the ref computed immediately above.
      const bytes = new Uint8Array(toBytes(content));
      const ref = hasher(bytes);
      const paths = refToPaths(ref);

      const { dir, blobPath, metaPath } = paths;

      await mkdir(dir, { recursive: true });

      await atomicWriteBlob(blobPath, bytes);

      const metadata: ContentMetadata = {
        size: bytes.length,
        mimeType: options?.mimeType ?? "application/octet-stream",
        createdAt: new Date().toISOString(),
        createdBy: options?.createdBy,
      };

      await exclusiveWriteMeta(metaPath, JSON.stringify(metadata, null, 2), bytes.length);

      return ref;
    },

    async get(ref: ContentRef): Promise<ContentBlob | undefined> {
      if (!isSha256ContentRef(ref as string)) return undefined;

      const paths = refToPaths(ref);

      const { blobPath, metaPath } = paths;
      try {
        const [rawContent, rawMeta] = await Promise.all([
          readFile(blobPath),
          readFile(metaPath, "utf-8"),
        ]);
        const bytes = new Uint8Array(rawContent);

        const actualRef = hasher(bytes);
        if (actualRef !== ref) {
          throw new Error(
            `[content] corruption detected: stored blob hash mismatch for ${ref as string}`,
          );
        }

        const metadata = parseStoredMetadata(rawMeta, bytes.length, ref);
        return { ref, bytes, metadata };
      } catch (err: unknown) {
        if (isEnoent(err)) return undefined;
        throw err;
      }
    },

    async exists(ref: ContentRef): Promise<boolean> {
      if (!isSha256ContentRef(ref as string)) return false;
      const paths = refToPaths(ref);
      return fileExists(paths.blobPath);
    },

    async metadata(ref: ContentRef): Promise<ContentMetadata | undefined> {
      if (!isSha256ContentRef(ref as string)) return undefined;
      const paths = refToPaths(ref);
      try {
        const [raw, blobStat] = await Promise.all([
          readFile(paths.metaPath, "utf-8"),
          stat(paths.blobPath),
        ]);
        return parseStoredMetadata(raw, blobStat.size, ref);
      } catch (err: unknown) {
        if (isEnoent(err)) return undefined;
        throw err;
      }
    },

    async count(): Promise<number> {
      let total = 0;
      try {
        const prefixes = await readdir(rootDir);
        for (const prefix of prefixes) {
          if (prefix.length === 2 && HEX_CHAR.test(prefix)) {
            const files = await readdir(join(rootDir, prefix));
            total += files.filter((f) => f.endsWith(".blob")).length;
          }
        }
      } catch (err: unknown) {
        if (isEnoent(err)) return 0;
        throw err;
      }
      return total;
    },

    async list(): Promise<readonly ContentEntry[]> {
      const result: ContentEntry[] = [];
      try {
        const prefixes = await readdir(rootDir);
        for (const prefix of prefixes) {
          if (prefix.length !== 2 || !HEX_CHAR.test(prefix)) continue;
          const dir = join(rootDir, prefix);
          const files = await readdir(dir);
          for (const file of files) {
            // A stored blob is <64hex>.blob; its sibling <64hex>.meta.json
            // carries the canonical metadata. Skip repair claims and temp files.
            if (!file.endsWith(".blob")) continue;
            const hex = file.slice(0, -".blob".length);
            if (hex.length !== 64 || !HEX_CHAR.test(hex)) continue;
            const ref = `sha256:${hex}` as ContentRef;
            const metaPath = join(dir, `${hex}.meta.json`);
            try {
              const [raw, blobStat] = await Promise.all([
                readFile(metaPath, "utf-8"),
                stat(join(dir, file)),
              ]);
              result.push({ ref, metadata: parseStoredMetadata(raw, blobStat.size, ref) });
            } catch (err: unknown) {
              // A blob whose metadata is missing/corrupt is listed with the
              // corruption surfaced by metadata() callers; list() reports the
              // ref only when both blob and valid metadata are present so stats
              // never silently count a half-written entry.
              if (isEnoent(err) || err instanceof SyntaxError) continue;
              throw err;
            }
          }
        }
      } catch (err: unknown) {
        if (isEnoent(err)) return result;
        throw err;
      }
      return result;
    },

    async remove(ref: ContentRef): Promise<boolean> {
      if (!isSha256ContentRef(ref as string)) return false;
      const paths = refToPaths(ref);
      const { blobPath, metaPath } = paths;
      const claimPath = `${metaPath}.repair.claim`;

      const blobExisted = await fileExists(blobPath);
      if (!blobExisted) return false;

      await unlinkIfPresent(blobPath);
      await unlinkIfPresent(metaPath);
      await unlinkIfPresent(claimPath);
      return true;
    },
  };
}

function parseStoredMetadata(raw: string, byteLength: number, ref: ContentRef): ContentMetadata {
  const value = JSON.parse(raw) as unknown;
  if (!isContentMetadata(value, byteLength)) {
    throw new Error(
      `[content] corruption detected: stored metadata is invalid for ${ref as string}`,
    );
  }
  return value;
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}

function isEexist(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "EEXIST"
  );
}
