import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireFileLock, withFileLock } from "../../../src/memory/fileLock.js";

const LOCK_FILE = ".durable.lock";

/** A pid no live process can hold, standing in for an owner that was killed. */
const DEAD_PID = 0x7ffffffe;

function storage(): string {
  return mkdtempSync(join(tmpdir(), "cantilune-lock-"));
}

describe("fileLock", () => {
  it("allows sequential acquire after release", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-lock-"));
    try {
      const first = acquireFileLock(dir);
      first.release();
      const second = acquireFileLock(dir);
      second.release();
      expect(typeof second.release).toBe("function");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("publishes only a complete owner record and ignores an orphaned candidate", () => {
    const dir = storage();
    try {
      writeFileSync(join(dir, `${LOCK_FILE}.candidate-killed-child`), "", "utf8");

      const lock = acquireFileLock(dir);
      const owner = readFileSync(join(dir, LOCK_FILE), "utf8");

      expect(owner).toMatch(new RegExp(`^${String(process.pid)}:[^:]+:[0-9]+$`));
      lock.release();
      expect(existsSync(join(dir, LOCK_FILE))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs function under withFileLock", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-lock-"));
    try {
      const value = withFileLock(dir, () => 42);
      expect(value).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed when the recorded owner is gone", () => {
    const dir = storage();
    try {
      const stale = `${String(DEAD_PID)}:dead-owner:${String(Date.now())}`;
      writeFileSync(join(dir, LOCK_FILE), stale, "utf8");

      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(/automatic recovery disabled/);
      expect(readFileSync(join(dir, LOCK_FILE), "utf8")).toBe(stale);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows reacquisition only after quiesced manual stale-lock removal", () => {
    const dir = storage();
    try {
      writeFileSync(join(dir, LOCK_FILE), `${String(DEAD_PID)}:0`, "utf8");
      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(/timed out/);

      unlinkSync(join(dir, LOCK_FILE));
      acquireFileLock(dir).release();
      expect(existsSync(join(dir, LOCK_FILE))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not let an obsolete release delete a replacement token", () => {
    const dir = storage();
    const path = join(dir, LOCK_FILE);
    try {
      const obsolete = acquireFileLock(dir);
      unlinkSync(path);
      const replacement = `${String(process.pid)}:replacement:1`;
      writeFileSync(path, replacement, "utf8");

      obsolete.release();

      expect(readFileSync(path, "utf8")).toBe(replacement);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * The opposite failure: reclaiming on age alone would admit a second writer
   * behind any holder whose commit outlived the threshold.
   */
  it("refuses to break a live owner's lock however old it is", () => {
    const dir = storage();
    try {
      writeFileSync(join(dir, LOCK_FILE), `${String(process.pid)}:0`, "utf8");

      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(/timed out/);
      expect(readFileSync(join(dir, LOCK_FILE), "utf8")).toBe(`${String(process.pid)}:0`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names the recorded live holder in the timeout so the block is diagnosable", () => {
    const dir = storage();
    try {
      writeFileSync(join(dir, LOCK_FILE), `${String(process.pid)}:0`, "utf8");
      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(
        new RegExp(`recorded pid ${String(process.pid)} appears live`),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("waits rather than probing pid 0 when the owner has not written yet", () => {
    const dir = storage();
    try {
      writeFileSync(join(dir, LOCK_FILE), "", "utf8");
      expect(() => acquireFileLock(dir, { timeoutMs: 50 })).toThrow(/timed out/);
      expect(existsSync(join(dir, LOCK_FILE))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
