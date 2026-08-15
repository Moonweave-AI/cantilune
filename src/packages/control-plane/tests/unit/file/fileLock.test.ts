import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireFileLock, withFileLock } from "../../../src/file/fileLock.js";

describe("file lock", () => {
  it("acquires and releases exclusive lock", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-lock-"));
    try {
      const lock = acquireFileLock(dir);
      lock.release();
      expect(withFileLock(dir, () => 42)).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed for a dead owner until an operator removes the lock", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-lock-dead-"));
    const path = join(dir, ".control-plane.lock");
    try {
      const stale = "2147483646:dead-owner:0";
      writeFileSync(path, stale, "utf8");
      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(/automatic recovery disabled/);
      expect(readFileSync(path, "utf8")).toBe(stale);

      unlinkSync(path);
      acquireFileLock(dir).release();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves a replacement token when an obsolete handle releases", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-lock-token-"));
    const path = join(dir, ".control-plane.lock");
    try {
      const obsolete = acquireFileLock(dir);
      unlinkSync(path);
      writeFileSync(path, "2147483646:replacement:0", "utf8");
      obsolete.release();
      expect(readFileSync(path, "utf8")).toBe("2147483646:replacement:0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
