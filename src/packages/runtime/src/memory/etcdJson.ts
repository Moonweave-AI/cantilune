import type { RaftCompare, RaftKvEntry, RaftOp } from "./raftKv.js";

export interface EtcdJsonClient {
  post(path: string, body: Record<string, unknown>): Record<string, unknown>;
}

export function encodeEtcdKey(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export function decodeEtcdKey(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }
  return Buffer.from(value, "base64").toString("utf8");
}

/** etcd prefix range_end: increment the last byte (official client convention). */
export function etcdRangeEndBytes(bytes: Buffer): Buffer {
  const copy = Buffer.from(bytes);
  for (let index = copy.length - 1; index >= 0; index -= 1) {
    const current = copy[index];
    if (current !== undefined && current < 0xff) {
      copy[index] = current + 1;
      return copy.subarray(0, index + 1);
    }
  }
  return Buffer.from([0]);
}

export function etcdRangeEnd(prefix: string): string {
  return etcdRangeEndBytes(Buffer.from(prefix, "utf8")).toString("utf8");
}

export function decodeEtcdLeaseId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "" || value === 0 || value === "0") {
    return undefined;
  }
  if (typeof value === "string") {
    return value.length === 0 ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  return undefined;
}

export function decodeEtcdEntry(raw: Record<string, unknown>): RaftKvEntry {
  const leaseId = decodeEtcdLeaseId(raw.lease);
  return {
    key: decodeEtcdKey(raw.key),
    value: decodeEtcdKey(raw.value),
    version: Number(raw.version ?? 0),
    createRevision: Number(raw.create_revision ?? raw.createRevision ?? 0),
    modRevision: Number(raw.mod_revision ?? raw.modRevision ?? 0),
    ...(leaseId !== undefined ? { leaseId } : {}),
  };
}

export function encodeEtcdEntry(entry: RaftKvEntry): Record<string, unknown> {
  return {
    key: encodeEtcdKey(entry.key),
    value: encodeEtcdKey(entry.value),
    version: String(entry.version),
    create_revision: String(entry.createRevision),
    mod_revision: String(entry.modRevision),
    lease: entry.leaseId ?? "0",
  };
}

export function decodeEtcdEntries(payload: Record<string, unknown>): RaftKvEntry[] {
  const kvs = payload.kvs;
  if (!Array.isArray(kvs)) {
    return [];
  }
  return kvs
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map(decodeEtcdEntry);
}

export function encodeEtcdCompare(compare: RaftCompare): Record<string, unknown> {
  const result = compare.result === "equal" ? "EQUAL" : "NOT_EQUAL";
  if (compare.target === "create") {
    return {
      result,
      target: "CREATE",
      key: encodeEtcdKey(compare.key),
      create_revision: 0,
    };
  }
  if (compare.target === "version") {
    return {
      result,
      target: "VERSION",
      key: encodeEtcdKey(compare.key),
      version: compare.version ?? 0,
    };
  }
  return {
    result,
    target: "VALUE",
    key: encodeEtcdKey(compare.key),
    value: encodeEtcdKey(compare.value ?? ""),
  };
}

export function encodeEtcdOp(op: RaftOp): Record<string, unknown> {
  if (op.kind === "put") {
    return {
      requestPut: {
        key: encodeEtcdKey(op.key),
        value: encodeEtcdKey(op.value),
        ...(op.leaseId !== undefined ? { lease: op.leaseId } : {}),
      },
    };
  }
  if (op.kind === "delete") {
    return { requestDeleteRange: { key: encodeEtcdKey(op.key) } };
  }
  if (op.kind === "range") {
    return {
      requestRange: {
        key: encodeEtcdKey(op.prefix),
        range_end: encodeEtcdKey(etcdRangeEnd(op.prefix)),
      },
    };
  }
  return { requestRange: { key: encodeEtcdKey(op.key) } };
}

export function encodeEtcdTxn(
  compare: readonly RaftCompare[],
  success: readonly RaftOp[],
  failure: readonly RaftOp[],
): Record<string, unknown> {
  return {
    compare: compare.map(encodeEtcdCompare),
    success: success.map(encodeEtcdOp),
    failure: failure.map(encodeEtcdOp),
  };
}
