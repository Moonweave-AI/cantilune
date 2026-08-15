import { describe, expect, it } from "vitest";
import { footprint } from "@cantilune/core";
import { actorId, artifactId } from "@cantilune/core";
import { admittedId } from "../../../src/foundation/brands.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";

describe("MemoryResourceLockTable", () => {
  it("rejects overlapping footprint acquisition", () => {
    const locks = new MemoryResourceLockTable();
    const fpA = footprint({ artifactIds: [artifactId("task-T")] });
    const fpB = footprint({
      participantIds: [actorId("planner-p")],
      artifactIds: [artifactId("task-T")],
    });

    expect(locks.acquire(admittedId("adm-1"), fpA)).toBe(true);
    expect(locks.acquire(admittedId("adm-2"), fpB)).toBe(false);
  });

  it("allows acquisition after release", () => {
    const locks = new MemoryResourceLockTable();
    const fp = footprint({ artifactIds: [artifactId("task-T")] });
    const ticket = admittedId("adm-1");

    expect(locks.acquire(ticket, fp)).toBe(true);
    locks.release(ticket);
    expect(locks.acquire(admittedId("adm-2"), fp)).toBe(true);
  });
});
