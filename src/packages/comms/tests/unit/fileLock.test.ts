import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { acquireFileLock, withFileLock } from "../../src/file/fileLock.js";

describe("fileLock", () => {
  it("acquires and releases lock in temp dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-lock-"));
    const lockPath = join(dir, ".comms.lock");
    try {
      const lock = acquireFileLock(dir);
      expect(existsSync(lockPath)).toBe(true);
      lock.release();
      expect(existsSync(lockPath)).toBe(false);
      const again = acquireFileLock(dir);
      again.release();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("withFileLock runs fn and releases", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-lock-fn-"));
    try {
      const value = withFileLock(dir, () => 42);
      expect(value).toBe(42);
      acquireFileLock(dir).release();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed for a stale lock from a dead process", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-lock-stale-"));
    const lockPath = join(dir, ".comms.lock");
    try {
      writeFileSync(lockPath, "99999999:dead-owner:0");
      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(/automatic recovery disabled/);
      expect(existsSync(lockPath)).toBe(true);

      unlinkSync(lockPath);
      const lock = acquireFileLock(dir);
      lock.release();
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not delete a replacement token through an obsolete release handle", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-lock-token-"));
    const lockPath = join(dir, ".comms.lock");
    try {
      const obsolete = acquireFileLock(dir);
      unlinkSync(lockPath);
      writeFileSync(lockPath, "99999999:replacement:0", "utf8");
      obsolete.release();
      expect(readFileSync(lockPath, "utf8")).toBe("99999999:replacement:0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("release is idempotent when lock already gone", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-lock-rel-"));
    const lockPath = join(dir, ".comms.lock");
    try {
      const lock = acquireFileLock(dir);
      lock.release();
      expect(existsSync(lockPath)).toBe(false);
      expect(() => lock.release()).not.toThrow();
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
