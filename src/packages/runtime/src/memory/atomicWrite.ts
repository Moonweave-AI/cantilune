import { closeSync, fsyncSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const RENAME_RETRY_LIMIT = 20;
const RENAME_RETRY_MS = 10;

/**
 * Windows fails a rename with these codes while any other process still holds a
 * handle to either path — a virus scanner or search indexer touching a freshly
 * created file is enough. POSIX never reports them here.
 */
const TRANSIENT_RENAME_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

let tempSequence = 0;

function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

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
      pause(RENAME_RETRY_MS);
    }
  }
}

/**
 * Writes and flushes to the physical device before returning.
 *
 * A plain write only reaches the OS page cache, so a rename could be replayed
 * after a crash while the bytes it published were never persisted — leaving a
 * file that exists, is the right length, and contains zeroes.
 */
function writeFileDurable(path: string, data: string): void {
  const fd = openSync(path, "w");
  try {
    writeFileSync(fd, data, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Flushes the directory entry the rename created.
 *
 * Flushing the file itself does not persist the name pointing at it, so a crash
 * could still lose the publication. Windows refuses to open a directory, so an
 * unsupported platform degrades to the file-level guarantee instead of failing
 * the write.
 */
function syncDirectory(dirPath: string): void {
  let fd: number;
  try {
    fd = openSync(dirPath, "r");
  } catch {
    return;
  }
  try {
    fsyncSync(fd);
  } catch {
    // Directory fsync is unsupported on this platform.
  } finally {
    closeSync(fd);
  }
}

/**
 * Writes `data` so readers only ever observe the whole previous or whole next
 * content, and so a crash cannot lose an already-returned write. The temp path
 * carries pid and a sequence number so that concurrent processes, or a process
 * that died mid-write, can never publish each other's partial file.
 */
export function atomicWriteFileSync(targetPath: string, data: string): void {
  const tempPath = `${targetPath}.tmp-${String(process.pid)}-${String((tempSequence += 1))}`;
  writeFileDurable(tempPath, data);
  try {
    renameWithRetry(tempPath, targetPath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // temp file already gone
    }
    throw error;
  }
  syncDirectory(dirname(targetPath));
}
