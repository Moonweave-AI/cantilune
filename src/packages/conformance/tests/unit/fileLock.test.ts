import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { acquireFileLock, withFileLock } from "../../src/adapters/file/fileLock.js";

describe("conformance fileLock", () => {
  it("withFileLock releases lock for the next acquirer", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-lock-"));
    try {
      let ran = false;
      withFileLock(dir, () => {
        ran = true;
      });
      expect(ran).toBe(true);
      const lock = acquireFileLock(dir);
      lock.release();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed for a dead owner until quiesced manual removal", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-lock-dead-"));
    const path = join(dir, ".conformance.lock");
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

  it("does not let an obsolete release delete a replacement token", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-lock-token-"));
    const path = join(dir, ".conformance.lock");
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
