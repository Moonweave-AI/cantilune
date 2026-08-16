import {
  matchesCompare,
  type RaftCompare,
  type RaftKv,
  type RaftKvEntry,
  type RaftLease,
  type RaftOp,
  type RaftTxnResult,
} from "./raftKv.js";

interface StoredEntry {
  value: string;
  version: number;
  createRevision: number;
  modRevision: number;
  leaseId?: string;
}

interface StoredLease {
  readonly leaseId: string;
  readonly ttlSeconds: number;
  expiresAt: number;
}

export interface MemoryRaftKvOptions {
  readonly now?: () => number;
}

export class MemoryRaftKv implements RaftKv {
  private readonly store = new Map<string, StoredEntry>();
  private readonly leases = new Map<string, StoredLease>();
  private readonly now: () => number;
  private revision = 0;
  private leaseSeq = 0;

  constructor(options: MemoryRaftKvOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  get(key: string): RaftKvEntry | undefined {
    this.expireLeases();
    return this.toEntry(key, this.store.get(key));
  }

  range(prefix: string): readonly RaftKvEntry[] {
    this.expireLeases();
    const rows: RaftKvEntry[] = [];
    for (const [key, stored] of this.store) {
      if (key.startsWith(prefix)) {
        const entry = this.toEntry(key, stored);
        if (entry !== undefined) {
          rows.push(entry);
        }
      }
    }
    return rows.sort((left, right) => left.key.localeCompare(right.key));
  }

  txn(
    compare: readonly RaftCompare[],
    success: readonly RaftOp[],
    failure: readonly RaftOp[] = [],
  ): RaftTxnResult {
    this.expireLeases();
    const ok = compare.every((clause) => matchesCompare(this.toEntry(clause.key, this.store.get(clause.key)), clause));
    return { succeeded: ok, entries: this.applyOps(ok ? success : failure) };
  }

  grantLease(ttlSeconds: number): RaftLease {
    this.expireLeases();
    this.leaseSeq += 1;
    const leaseId = `lease-${String(this.leaseSeq)}`;
    const ttl = ttlSeconds > 0 ? ttlSeconds : 1;
    this.leases.set(leaseId, {
      leaseId,
      ttlSeconds: ttl,
      expiresAt: this.now() + ttl * 1000,
    });
    return { leaseId, ttlSeconds: ttl };
  }

  keepAlive(leaseId: string): boolean {
    this.expireLeases();
    const lease = this.leases.get(leaseId);
    if (lease === undefined) {
      return false;
    }
    lease.expiresAt = this.now() + lease.ttlSeconds * 1000;
    return true;
  }

  revokeLease(leaseId: string): void {
    this.dropLease(leaseId);
  }

  private applyOps(ops: readonly RaftOp[]): RaftKvEntry[] {
    const collected: RaftKvEntry[] = [];
    for (const op of ops) {
      if (op.kind === "get") {
        const entry = this.toEntry(op.key, this.store.get(op.key));
        if (entry !== undefined) {
          collected.push(entry);
        }
        continue;
      }
      if (op.kind === "range") {
        collected.push(...this.range(op.prefix));
        continue;
      }
      if (op.kind === "delete") {
        this.store.delete(op.key);
        continue;
      }
      this.revision += 1;
      const previous = this.store.get(op.key);
      const next: StoredEntry = {
        value: op.value,
        version: (previous?.version ?? 0) + 1,
        createRevision: previous?.createRevision ?? this.revision,
        modRevision: this.revision,
        ...(op.leaseId !== undefined ? { leaseId: op.leaseId } : {}),
      };
      this.store.set(op.key, next);
      const entry = this.toEntry(op.key, next);
      if (entry !== undefined) {
        collected.push(entry);
      }
    }
    return collected;
  }

  private expireLeases(): void {
    const now = this.now();
    for (const [leaseId, lease] of this.leases) {
      if (lease.expiresAt <= now) {
        this.dropLease(leaseId);
      }
    }
  }

  private dropLease(leaseId: string): void {
    this.leases.delete(leaseId);
    for (const [key, stored] of this.store) {
      if (stored.leaseId === leaseId) {
        this.store.delete(key);
      }
    }
  }

  private toEntry(key: string, stored: StoredEntry | undefined): RaftKvEntry | undefined {
    if (stored === undefined) {
      return undefined;
    }
    return {
      key,
      value: stored.value,
      version: stored.version,
      createRevision: stored.createRevision,
      modRevision: stored.modRevision,
      ...(stored.leaseId !== undefined ? { leaseId: stored.leaseId } : {}),
    };
  }
}

export function createMemoryRaftKv(options: MemoryRaftKvOptions = {}): RaftKv {
  return new MemoryRaftKv(options);
}
