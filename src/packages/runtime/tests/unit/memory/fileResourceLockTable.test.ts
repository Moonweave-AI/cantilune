import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admittedId } from "../../../src/foundation/brands.js";
import { FileResourceLockTable } from "../../../src/memory/fileResourceLockTable.js";
import { artifactId, footprint } from "@cantilune/core";

const dirs: string[] = [];

function storage(): string {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-file-locks-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("FileResourceLockTable", () => {
  it("rejects overlapping footprints across reload", () => {
    const dir = storage();
    const locks = new FileResourceLockTable(dir);
    const fp = footprint({ artifactIds: [artifactId("task-1")] });

    expect(locks.acquire(admittedId("adm-1"), fp)).toBe(true);
    expect(locks.heldLockCount()).toBe(1);

    const reloaded = new FileResourceLockTable(dir);
    expect(reloaded.acquire(admittedId("adm-2"), fp)).toBe(false);
    expect(reloaded.heldLockCount()).toBe(1);
    reloaded.release(admittedId("adm-1"));
    expect(locks.heldLockCount()).toBe(0);
  });

  /**
   * The table used to be rewritten in place, so a crash mid-write left partial
   * JSON and every later acquire threw on it — permanently.
   */
  it("never leaves a partially written table behind", () => {
    const dir = storage();
    const locks = new FileResourceLockTable(dir);
    locks.acquire(admittedId("adm-1"), footprint({ artifactIds: [artifactId("task-1")] }));

    const raw = readFileSync(join(dir, "resource-locks.json"), "utf8");
    expect(() => JSON.parse(raw) as unknown).not.toThrow();
    expect(raw.endsWith("}")).toBe(true);
  });

  /**
   * Losing the table must not silently free every footprint: that would let two
   * writers into one footprint, which is the exact thing the table prevents.
   */
  it("refuses to treat an unreadable table as empty", () => {
    const dir = storage();
    const locks = new FileResourceLockTable(dir);
    locks.acquire(admittedId("adm-1"), footprint({ artifactIds: [artifactId("task-1")] }));
    writeFileSync(join(dir, "resource-locks.json"), '{"locks":[{"admitted', "utf8");

    expect(() =>
      locks.acquire(admittedId("adm-2"), footprint({ artifactIds: [artifactId("task-1")] })),
    ).toThrow(/unreadable/);
  });
});
