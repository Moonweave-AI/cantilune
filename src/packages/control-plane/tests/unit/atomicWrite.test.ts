import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type * as NodeFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteFileSync } from "../../src/file/atomicWrite.js";

/**
 * The helper binds `node:fs` through named ESM imports, so the failure paths are
 * only reachable by substituting the module itself.
 */
const hooks = vi.hoisted(() => ({
  renameSync: null as null | ((from: string, to: string) => void),
  unlinkSync: null as null | ((path: string) => void),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof NodeFs>("node:fs");
  return {
    ...actual,
    renameSync: (from: string, to: string): void => {
      (hooks.renameSync ?? actual.renameSync)(from, to);
    },
    unlinkSync: (path: string): void => {
      (hooks.unlinkSync ?? actual.unlinkSync)(path);
    },
  };
});

const realFs = await vi.importActual<typeof NodeFs>("node:fs");

function errno(code: string): NodeJS.ErrnoException {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

describe("atomicWriteFileSync", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cantilune-atomic-write-"));
  });

  afterEach(() => {
    hooks.renameSync = null;
    hooks.unlinkSync = null;
    rmSync(dir, { recursive: true, force: true });
  });

  it("publishes the payload at the target path", () => {
    const target = join(dir, "snapshot.json");
    atomicWriteFileSync(target, '{"a":1}');
    expect(readFileSync(target, "utf8")).toBe('{"a":1}');
  });

  it("replaces existing content and leaves no temp file behind", () => {
    const target = join(dir, "snapshot.json");
    writeFileSync(target, "stale", "utf8");
    atomicWriteFileSync(target, "fresh");
    expect(readFileSync(target, "utf8")).toBe("fresh");
    expect(readdirSync(dir)).toEqual(["snapshot.json"]);
  });

  it("never reuses a temp path across successive writes", () => {
    const seen = new Set<string>();
    hooks.renameSync = (from) => {
      seen.add(from);
      realFs.unlinkSync(from);
    };

    const target = join(dir, "snapshot.json");
    atomicWriteFileSync(target, "one");
    atomicWriteFileSync(target, "two");

    expect(seen.size).toBe(2);
    for (const path of seen) {
      expect(path).toContain(`.tmp-${String(process.pid)}-`);
    }
  });

  it("retries a rename that Windows rejects with a transient sharing violation", () => {
    let attempts = 0;
    hooks.renameSync = (from, to) => {
      attempts += 1;
      if (attempts < 3) {
        throw errno("EPERM");
      }
      realFs.renameSync(from, to);
    };

    const target = join(dir, "snapshot.json");
    atomicWriteFileSync(target, "eventually");

    expect(attempts).toBe(3);
    expect(readFileSync(target, "utf8")).toBe("eventually");
  });

  it("gives up on a non-transient rename failure and removes the temp file", () => {
    hooks.renameSync = () => {
      throw errno("ENOSPC");
    };

    const target = join(dir, "snapshot.json");
    expect(() => {
      atomicWriteFileSync(target, "doomed");
    }).toThrow(/ENOSPC/);

    expect(existsSync(target)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("stops retrying a persistently transient rename", () => {
    let attempts = 0;
    hooks.renameSync = () => {
      attempts += 1;
      throw errno("EBUSY");
    };

    expect(() => {
      atomicWriteFileSync(join(dir, "snapshot.json"), "doomed");
    }).toThrow(/EBUSY/);

    expect(attempts).toBe(21);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("surfaces the rename failure even when the temp file cannot be cleaned up", () => {
    hooks.renameSync = () => {
      throw errno("ENOSPC");
    };
    hooks.unlinkSync = () => {
      throw errno("ENOENT");
    };

    expect(() => {
      atomicWriteFileSync(join(dir, "snapshot.json"), "doomed");
    }).toThrow(/ENOSPC/);
  });

  it("treats a rename error without a code as fatal", () => {
    hooks.renameSync = () => {
      throw new Error("boom");
    };

    expect(() => {
      atomicWriteFileSync(join(dir, "snapshot.json"), "doomed");
    }).toThrow(/boom/);
  });
});
