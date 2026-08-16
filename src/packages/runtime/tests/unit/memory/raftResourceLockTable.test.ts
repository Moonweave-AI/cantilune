import { describe, expect, it } from "vitest";
import { artifactId, footprint } from "@cantilune/core";
import { admittedId } from "../../../src/foundation/brands.js";
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";
import { RaftResourceLockTable } from "../../../src/memory/raftResourceLockTable.js";

describe("RaftResourceLockTable", () => {
  it("rejects overlapping footprints across a shared KV", () => {
    const kv = createMemoryRaftKv();
    const locks = new RaftResourceLockTable(kv);
    const fp = footprint({ artifactIds: [artifactId("task-1")] });
    expect(locks.acquire(admittedId("adm-1"), fp)).toBe(true);
    expect(locks.heldLockCount()).toBe(1);
    expect(locks.isHeld(admittedId("adm-1"))).toBe(true);
    const peer = new RaftResourceLockTable(kv);
    expect(peer.acquire(admittedId("adm-2"), fp)).toBe(false);
    peer.release(admittedId("adm-1"));
    expect(locks.heldLockCount()).toBe(0);
    expect(peer.acquire(admittedId("adm-2"), fp, 60_000)).toBe(true);
  });

  it("refuses to treat an unreadable table as empty", () => {
    const kv = createMemoryRaftKv();
    const locks = new RaftResourceLockTable(kv);
    kv.txn([], [{ kind: "put", key: "cantilune/durable/locks", value: '{"locks":[{"admitted' }]);
    expect(() =>
      locks.acquire(admittedId("adm-2"), footprint({ artifactIds: [artifactId("task-1")] })),
    ).toThrow(/unreadable/);
  });

  it("fails closed when lock CAS cannot commit", () => {
    const inner = createMemoryRaftKv();
    const kv = {
      get: (key: string) => inner.get(key),
      range: (prefix: string) => inner.range(prefix),
      grantLease: (ttl: number) => inner.grantLease(ttl),
      keepAlive: (id: string) => inner.keepAlive(id),
      revokeLease: (id: string) => inner.revokeLease(id),
      txn: () => ({ succeeded: false, entries: [] }),
    };
    const locks = new RaftResourceLockTable(kv);
    expect(() =>
      locks.acquire(admittedId("adm-1"), footprint({ artifactIds: [artifactId("task-1")] })),
    ).toThrow(/CAS exhausted/);
  });

  it("rejects an unsafe namespace", () => {
    expect(() => new RaftResourceLockTable(createMemoryRaftKv(), "bad;ns")).toThrow(
      /simple identifier/,
    );
  });
});
