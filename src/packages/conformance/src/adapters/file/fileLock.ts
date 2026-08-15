import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const LOCK_FILE = ".conformance.lock";
const DEFAULT_TIMEOUT_MS = 30_000;
const SPIN_MS = 10;

export interface FileLockHandle {
  readonly release: () => void;
}

export interface FileLockOptions {
  /** How long to wait for an existing holder before giving up. */
  readonly timeoutMs?: number;
}

function lockPath(dir: string): string {
  return join(dir, LOCK_FILE);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function lockOwner(path: string): number | undefined {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
  const pid = Number(raw.split(":")[0]);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function ownerDiagnostic(path: string): string {
  const owner = lockOwner(path);
  if (owner === undefined) return "";
  const observed = isProcessAlive(owner) ? "appears live" : "is not observable";
  return ` (recorded pid ${String(owner)} ${observed}; automatic recovery disabled)`;
}

function publishLockCandidate(path: string): string | undefined {
  const token = `${String(process.pid)}:${randomUUID()}:${String(Date.now())}`;
  const candidate = `${path}.candidate-${randomUUID()}`;
  let candidateCreated = false;
  let fd: number | undefined;
  try {
    fd = openSync(candidate, "wx", 0o600);
    candidateCreated = true;
    writeFileSync(fd, token, "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    linkSync(candidate, path);
    return token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return undefined;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Candidate cleanup below remains best effort.
      }
    }
    if (candidateCreated) {
      try {
        unlinkSync(candidate);
      } catch {
        // A crash may leave an inert candidate, never the authoritative lock.
      }
    }
  }
}

function releaseOwnedLock(path: string, token: string): void {
  try {
    if (readFileSync(path, "utf8") === token) unlinkSync(path);
  } catch {
    // Lock may already be gone; never delete a replacement owner.
  }
}

/**
 * Cross-process exclusive lock via atomic hard-link publication.
 *
 * A dead owner's lock deliberately fails closed. PID liveness cannot authorize
 * deletion because PIDs are reusable and Node has no portable atomic
 * compare-owner-and-unlink operation. An operator may remove an abandoned lock
 * only after quiescing every process that can access this storage directory.
 */
export function acquireFileLock(dir: string, options: FileLockOptions = {}): FileLockHandle {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  mkdirSync(dir, { recursive: true });
  const path = lockPath(dir);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const token = publishLockCandidate(path);
    if (token !== undefined) {
      return { release: () => releaseOwnedLock(path, token) };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SPIN_MS);
  }

  throw new Error(
    `acquireFileLock timed out after ${String(timeoutMs)}ms: ${path}${ownerDiagnostic(path)}`,
  );
}

export function withFileLock<T>(dir: string, fn: () => T, options?: FileLockOptions): T {
  const lock = acquireFileLock(dir, options);
  try {
    return fn();
  } finally {
    lock.release();
  }
}

export async function withFileLockAsync<T>(
  dir: string,
  fn: () => Promise<T>,
  options?: FileLockOptions,
): Promise<T> {
  const lock = acquireFileLock(dir, options);
  try {
    return await fn();
  } finally {
    lock.release();
  }
}
