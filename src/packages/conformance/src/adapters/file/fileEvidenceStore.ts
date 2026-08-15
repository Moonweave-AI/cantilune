import { err, ok } from "@cantilune/core";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { withFileLock } from "./fileLock.js";
import type { EvidenceStore } from "../../ports/evidenceStore.js";
import { isSha256HexDigest } from "../../canonical/evidenceDigest.js";

const CAS_DIR = "cas";

function digestObjectPath(baseDir: string, digest: string): string {
  if (!isSha256HexDigest(digest)) {
    throw new Error(`invalid content digest: ${digest}`);
  }
  const aa = digest.slice(0, 2);
  const bb = digest.slice(2, 4);
  const resolvedBase = resolve(baseDir);
  const objectPath = resolve(join(resolvedBase, CAS_DIR, aa, bb, digest));
  if (objectPath !== resolvedBase && !objectPath.startsWith(resolvedBase + sep)) {
    throw new Error("path traversal rejected");
  }
  return objectPath;
}

function verifyContentDigest(digest: string, bytes: Uint8Array): boolean {
  const computed = createHash("sha256").update(bytes).digest("hex");
  return computed === digest;
}

const RENAME_RETRY_LIMIT = 20;
const RENAME_RETRY_MS = 10;

/**
 * Windows fails a rename with these codes while any other process still holds a
 * handle to either path — a virus scanner or search indexer touching a freshly
 * created file is enough. POSIX never reports them here.
 */
const TRANSIENT_RENAME_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

let tempSequence = 0;

function renameWithRetry(tempPath: string, targetPath: string): void {
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(tempPath, targetPath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const transient = code !== undefined && TRANSIENT_RENAME_CODES.has(code);
      if (!transient || attempt >= RENAME_RETRY_LIMIT) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_RETRY_MS);
    }
  }
}

function atomicWriteFile(path: string, bytes: Uint8Array): void {
  const tempPath = `${path}.tmp-${String(process.pid)}-${String((tempSequence += 1))}`;
  mkdirSync(join(path, ".."), { recursive: true });
  const fd = openSync(tempPath, "wx");
  try {
    writeSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameWithRetry(tempPath, path);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // temp file already gone
    }
    throw error;
  }
}

export interface FileEvidenceStoreOptions {
  readonly dir: string;
  readonly verifyDigestOnPut?: boolean;
}

export function createFileEvidenceStore(options: FileEvidenceStoreOptions): EvidenceStore {
  const { dir, verifyDigestOnPut = true } = options;
  mkdirSync(join(dir, CAS_DIR), { recursive: true });

  return {
    async put(digest, bytes) {
      if (!isSha256HexDigest(digest)) {
        throw new Error(`invalid content digest: ${digest}`);
      }
      if (verifyDigestOnPut && !verifyContentDigest(digest, bytes)) {
        return err("unavailable");
      }
      try {
        return withFileLock(dir, () => {
          const path = digestObjectPath(dir, digest);
          if (existsSync(path)) {
            return err("unavailable");
          }
          atomicWriteFile(path, bytes);
          return ok(undefined);
        });
      } catch {
        return err("unavailable");
      }
    },

    async get(digest) {
      if (!isSha256HexDigest(digest)) {
        throw new Error(`invalid content digest: ${digest}`);
      }
      try {
        const path = digestObjectPath(dir, digest);
        if (!existsSync(path)) {
          return err("not_found");
        }
        const bytes = readFileSync(path);
        if (!verifyContentDigest(digest, bytes)) {
          return err("unavailable");
        }
        return ok(bytes);
      } catch {
        return err("unavailable");
      }
    },

    async has(digest) {
      try {
        const path = digestObjectPath(dir, digest);
        if (!existsSync(path)) {
          return false;
        }
        const bytes = readFileSync(path);
        return verifyContentDigest(digest, bytes);
      } catch {
        return false;
      }
    },
  };
}
