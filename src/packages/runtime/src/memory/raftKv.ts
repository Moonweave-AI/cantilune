/**
 * Linearizable KV + lease + compare-and-swap transaction.
 * Production is official etcd (Raft). Tests inject an in-process store.
 */
export interface RaftKvEntry {
  readonly key: string;
  readonly value: string;
  readonly version: number;
  readonly createRevision: number;
  readonly modRevision: number;
  readonly leaseId?: string;
}

export interface RaftCompare {
  readonly key: string;
  readonly target: "value" | "version" | "create";
  readonly result: "equal" | "notEqual";
  readonly value?: string;
  readonly version?: number;
}

export type RaftOp =
  | { readonly kind: "put"; readonly key: string; readonly value: string; readonly leaseId?: string }
  | { readonly kind: "get"; readonly key: string }
  | { readonly kind: "range"; readonly prefix: string }
  | { readonly kind: "delete"; readonly key: string };

export interface RaftTxnResult {
  readonly succeeded: boolean;
  readonly entries: readonly RaftKvEntry[];
}

export interface RaftLease {
  readonly leaseId: string;
  readonly ttlSeconds: number;
}

export interface RaftKv {
  get(key: string): RaftKvEntry | undefined;
  range(prefix: string): readonly RaftKvEntry[];
  txn(
    compare: readonly RaftCompare[],
    success: readonly RaftOp[],
    failure?: readonly RaftOp[],
  ): RaftTxnResult;
  grantLease(ttlSeconds: number): RaftLease;
  keepAlive(leaseId: string): boolean;
  revokeLease(leaseId: string): void;
  close?(): void;
}

const IDENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function assertSafeNamespace(name: string, label = "namespace"): void {
  if (!IDENT_PATTERN.test(name)) {
    throw new Error(`${label} must be a simple identifier, got ${name}`);
  }
}

export function matchesCompare(entry: RaftKvEntry | undefined, compare: RaftCompare): boolean {
  if (compare.target === "create") {
    const created = entry !== undefined && entry.createRevision > 0;
    return compare.result === "equal" ? !created : created;
  }
  if (compare.target === "version") {
    const version = entry?.version ?? 0;
    const expected = compare.version ?? 0;
    return compare.result === "equal" ? version === expected : version !== expected;
  }
  const value = entry?.value;
  const expected = compare.value;
  if (compare.result === "equal") {
    return value === expected;
  }
  return value !== expected;
}
