import {
  decodeEtcdKey,
  encodeEtcdEntry,
  type EtcdJsonClient,
} from "../../src/memory/etcdJson.js";
import type { RaftCompare, RaftKv, RaftOp } from "../../src/memory/raftKv.js";

export function createMemoryEtcdJsonClient(kv: RaftKv): EtcdJsonClient {
  return {
    post(path, body) {
      if (path === "/v3/kv/range") {
        return rangeResponse(kv, body);
      }
      if (path === "/v3/kv/txn") {
        return txnResponse(kv, body);
      }
      if (path === "/v3/lease/grant") {
        const lease = kv.grantLease(Number(body.TTL ?? 1));
        return { ID: lease.leaseId, TTL: String(lease.ttlSeconds) };
      }
      if (path === "/v3/lease/keepalive") {
        const leaseId = String(body.ID ?? "");
        return kv.keepAlive(leaseId) ? { result: { ID: leaseId } } : {};
      }
      if (path === "/v3/lease/revoke") {
        kv.revokeLease(String(body.ID ?? ""));
        return {};
      }
      if (path === "/v3/maintenance/status") {
        return { header: { raft_term: "1", cluster_id: "memory" } };
      }
      throw new Error(`unsupported etcd path ${path}`);
    },
  };
}

function rangeResponse(kv: RaftKv, body: Record<string, unknown>): Record<string, unknown> {
  const key = decodeEtcdKey(body.key);
  if (body.range_end === undefined) {
    const entry = kv.get(key);
    return { kvs: entry === undefined ? [] : [encodeEtcdEntry(entry)] };
  }
  const rangeEnd = decodeEtcdKey(body.range_end);
  return {
    kvs: kv
      .range(key)
      .filter((entry) => entry.key < rangeEnd)
      .map(encodeEtcdEntry),
  };
}

function txnResponse(kv: RaftKv, body: Record<string, unknown>): Record<string, unknown> {
  const compare = Array.isArray(body.compare) ? body.compare.map(decodeCompare) : [];
  const success = Array.isArray(body.success) ? body.success.map(decodeOp) : [];
  const failure = Array.isArray(body.failure) ? body.failure.map(decodeOp) : [];
  const result = kv.txn(compare, success, failure);
  return {
    succeeded: result.succeeded,
    responses: result.entries.length > 0
      ? [{ response_range: { kvs: result.entries.map(encodeEtcdEntry) } }]
      : [],
  };
}

function decodeCompare(raw: unknown): RaftCompare {
  const record = asRecord(raw);
  const key = decodeEtcdKey(record.key);
  const result = record.result === "NOT_EQUAL" ? "notEqual" : "equal";
  if (record.target === "CREATE") {
    return { key, target: "create", result };
  }
  if (record.target === "VERSION") {
    return { key, target: "version", result, version: Number(record.version ?? 0) };
  }
  return { key, target: "value", result, value: decodeEtcdKey(record.value) };
}

function decodeOp(raw: unknown): RaftOp {
  const record = asRecord(raw);
  const put = record.requestPut ?? record.request_put;
  if (typeof put === "object" && put !== null) {
    const body = put as Record<string, unknown>;
    const leaseId =
      body.lease === undefined || body.lease === 0 || body.lease === "0"
        ? undefined
        : String(body.lease);
    return {
      kind: "put",
      key: decodeEtcdKey(body.key),
      value: decodeEtcdKey(body.value),
      ...(leaseId !== undefined ? { leaseId } : {}),
    };
  }
  const del = record.requestDeleteRange ?? record.request_delete_range;
  if (typeof del === "object" && del !== null) {
    return { kind: "delete", key: decodeEtcdKey((del as Record<string, unknown>).key) };
  }
  const range = record.requestRange ?? record.request_range;
  if (typeof range === "object" && range !== null) {
    const body = range as Record<string, unknown>;
    if (body.range_end !== undefined) {
      return { kind: "range", prefix: decodeEtcdKey(body.key) };
    }
    return { kind: "get", key: decodeEtcdKey(body.key) };
  }
  throw new Error("unsupported etcd txn op");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("expected etcd JSON object");
  }
  return value as Record<string, unknown>;
}
