import { describe, expect, it } from "vitest";
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";

describe("MemoryRaftKv", () => {
  it("puts, ranges, and compare-and-swaps a versioned key", () => {
    const kv = createMemoryRaftKv();
    expect(kv.get("missing")).toBeUndefined();
    const created = kv.txn(
      [{ key: "head", target: "create", result: "equal" }],
      [{ kind: "put", key: "head", value: "snap-0" }],
    );
    expect(created.succeeded).toBe(true);
    expect(kv.get("head")?.value).toBe("snap-0");
    const raced = kv.txn(
      [{ key: "head", target: "value", result: "equal", value: "snap-other" }],
      [{ kind: "put", key: "head", value: "snap-1" }],
    );
    expect(raced.succeeded).toBe(false);
    expect(kv.get("head")?.value).toBe("snap-0");
    kv.txn([], [{ kind: "put", key: "changes/1", value: "a" }, { kind: "put", key: "changes/2", value: "b" }]);
    expect(kv.range("changes/").map((entry) => entry.value)).toEqual(["a", "b"]);
    kv.txn([], [{ kind: "delete", key: "changes/1" }]);
    expect(kv.range("changes/")).toHaveLength(1);
  });

  it("expires a leased key and keeps a live lease", () => {
    let now = 1_000;
    const kv = createMemoryRaftKv({ now: () => now });
    const lease = kv.grantLease(1);
    kv.txn([], [{ kind: "put", key: "fence", value: "owner-a", leaseId: lease.leaseId }]);
    expect(kv.keepAlive(lease.leaseId)).toBe(true);
    now = 3_000;
    expect(kv.get("fence")).toBeUndefined();
    expect(kv.keepAlive(lease.leaseId)).toBe(false);
    const next = kv.grantLease(5);
    kv.txn([], [{ kind: "put", key: "fence", value: "owner-b", leaseId: next.leaseId }]);
    kv.revokeLease(next.leaseId);
    expect(kv.get("fence")).toBeUndefined();
  });

  it("runs failure ops when compare does not match", () => {
    const kv = createMemoryRaftKv();
    const result = kv.txn(
      [{ key: "missing", target: "value", result: "equal", value: "x" }],
      [{ kind: "put", key: "ok", value: "yes" }],
      [{ kind: "get", key: "missing" }, { kind: "range", prefix: "nope/" }],
    );
    expect(result.succeeded).toBe(false);
    expect(kv.get("ok")).toBeUndefined();
  });
});
