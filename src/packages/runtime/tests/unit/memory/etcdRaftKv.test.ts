import { describe, expect, it } from "vitest";
import {
  decodeEtcdEntries,
  decodeEtcdKey,
  encodeEtcdKey,
  encodeEtcdTxn,
} from "../../../src/memory/etcdJson.js";
import {
  collectTxnEntries,
  createEtcdRaftKv,
  decodeEtcdWorkerReply,
} from "../../../src/memory/etcdRaftKv.js";
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";
import { startProcessEtcdGateway } from "../../support/etcdJsonGateway.js";
import { createMemoryEtcdJsonClient } from "../../support/memoryEtcdJsonClient.js";

describe("EtcdRaftKv", () => {
  it("round-trips KV, txn, and leases through the official JSON shapes", () => {
    const store = createMemoryRaftKv();
    const kv = createEtcdRaftKv({
      endpoints: ["http://127.0.0.1:2379"],
      client: createMemoryEtcdJsonClient(store),
    });
    expect(kv.get("missing")).toBeUndefined();
    const lease = kv.grantLease(30);
    expect(lease.leaseId.length).toBeGreaterThan(0);
    expect(
      kv.txn(
        [{ key: "head", target: "create", result: "equal" }],
        [{ kind: "put", key: "head", value: "snap-0", leaseId: lease.leaseId }],
      ).succeeded,
    ).toBe(true);
    expect(kv.get("head")?.value).toBe("snap-0");
    expect(kv.keepAlive(lease.leaseId)).toBe(true);
    kv.txn(
      [],
      [
        { kind: "put", key: "ns/a", value: "1" },
        { kind: "put", key: "ns/b", value: "2" },
      ],
    );
    expect(kv.range("ns/").map((entry) => entry.value)).toEqual(["1", "2"]);
    kv.revokeLease(lease.leaseId);
    expect(kv.get("head")).toBeUndefined();
    kv.close?.();
  });

  it("speaks the official JSON gateway through the synchronous worker", async () => {
    const gateway = await startProcessEtcdGateway();
    const kv = createEtcdRaftKv({ endpoints: [gateway.url] });
    try {
      expect(
        kv.txn(
          [{ key: "head", target: "create", result: "equal" }],
          [{ kind: "put", key: "head", value: "snap-worker" }],
        ).succeeded,
      ).toBe(true);
      expect(kv.get("head")?.value).toBe("snap-worker");
      const lease = kv.grantLease(5);
      expect(kv.keepAlive(lease.leaseId)).toBe(true);
      kv.revokeLease(lease.leaseId);
      kv.close?.();
      kv.close?.();
    } finally {
      gateway.close();
    }
  });

  it("surfaces JSON gateway failures from the worker", async () => {
    const stub = await startProcessEtcdGateway({ CANTILUNE_ETCD_STUB_STATUS: "503" });
    const kv = createEtcdRaftKv({ endpoints: [stub.url] });
    try {
      expect(() => kv.get("head")).toThrow(/etcd/);
    } finally {
      kv.close?.();
      stub.close();
    }
  });

  it("rejects a lease grant without an ID", () => {
    const kv = createEtcdRaftKv({
      endpoints: ["http://127.0.0.1:2379"],
      client: {
        post() {
          return {};
        },
      },
    });
    expect(() => kv.grantLease(0)).toThrow(/lease/);
    expect(kv.keepAlive("1")).toBe(false);
    kv.close?.();
  });

  it("rejects a missing endpoint and decodes worker / txn payloads", () => {
    expect(() => createEtcdRaftKv({ endpoints: [] })).toThrow(/endpoint/);
    expect(decodeEtcdWorkerReply(null)).toEqual({
      ok: false,
      message: "invalid etcd worker response",
    });
    expect(decodeEtcdWorkerReply({ ok: false })).toEqual({
      ok: false,
      message: "etcd request failed",
    });
    expect(decodeEtcdWorkerReply({ ok: true, payload: { succeeded: true } }).ok).toBe(true);
    expect(collectTxnEntries({ responses: [{ responseRange: { kvs: [] } }, null, 1] })).toEqual([]);
    expect(decodeEtcdKey("")).toBe("");
    expect(decodeEtcdEntries({ kvs: "nope" })).toEqual([]);
    const encoded = encodeEtcdTxn(
      [
        { key: "k", target: "version", result: "notEqual", version: 1 },
        { key: "k", target: "create", result: "equal" },
        { key: "k", target: "value", result: "equal", value: "v" },
      ],
      [
        { kind: "delete", key: "k" },
        { kind: "range", prefix: "p/" },
      ],
      [{ kind: "get", key: "k" }],
    );
    expect(encoded.compare).toHaveLength(3);
    expect(encodeEtcdKey("k").length).toBeGreaterThan(0);
  });
});
