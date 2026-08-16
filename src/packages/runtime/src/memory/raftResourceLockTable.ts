import {
  overlaps,
  type ActorId,
  type ArtifactId,
  type CapabilityId,
  type Footprint,
  type LinkId,
  type SessionId,
} from "@cantilune/core";
import type { AdmittedId } from "../foundation/brands.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import { assertSafeNamespace, type RaftKv } from "./raftKv.js";

interface LockEntryWire {
  readonly admittedId: string;
  readonly footprint: FootprintWire;
  readonly expiresAt?: number;
}

interface FootprintWire {
  readonly artifactIds: readonly string[];
  readonly participantIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly capabilityIds: readonly string[];
  readonly linkIds: readonly string[];
}

export class RaftResourceLockTable implements ResourceLockTable {
  private readonly key: string;

  constructor(
    private readonly kv: RaftKv,
    namespace = "cantilune",
  ) {
    assertSafeNamespace(namespace);
    this.key = `${namespace}/durable/locks`;
  }

  acquire(admittedId: AdmittedId, footprint: Footprint, leaseMs?: number): boolean {
    return this.mutate((active) => {
      for (const existing of active) {
        if (overlaps(footprintFromWire(existing.footprint), footprint)) {
          return { locks: active, result: false };
        }
      }
      active.push({
        admittedId,
        footprint: footprintToWire(footprint),
        ...(leaseMs !== undefined ? { expiresAt: Date.now() + leaseMs } : {}),
      });
      return { locks: active, result: true };
    });
  }

  release(admittedId: AdmittedId): void {
    this.mutate((active) => ({
      locks: active.filter((entry) => entry.admittedId !== admittedId),
      result: undefined,
    }));
  }

  isHeld(admittedId: AdmittedId): boolean {
    return this.mutate((active) => ({
      locks: active,
      result: active.some((entry) => entry.admittedId === admittedId),
    }));
  }

  heldLockCount(): number {
    return this.mutate((active) => ({ locks: active, result: active.length }));
  }

  private mutate<T>(work: (active: LockEntryWire[]) => { locks: LockEntryWire[]; result: T }): T {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const current = this.kv.get(this.key);
      const active = releaseExpired(decodeLocks(current?.value));
      const next = work(active);
      const compare =
        current === undefined
          ? ([{ key: this.key, target: "create" as const, result: "equal" as const }] as const)
          : ([
              {
                key: this.key,
                target: "version" as const,
                result: "equal" as const,
                version: current.version,
              },
            ] as const);
      const txn = this.kv.txn(compare, [
        { kind: "put", key: this.key, value: JSON.stringify({ locks: next.locks }) },
      ]);
      if (txn.succeeded) {
        return next.result;
      }
    }
    throw new Error("raft resource lock table CAS exhausted (ADR-0029)");
  }
}

function decodeLocks(raw: string | undefined): LockEntryWire[] {
  if (raw === undefined || raw.length === 0) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `raft resource lock table is unreadable; a holder cannot be determined: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("raft resource lock table is unreadable; a holder cannot be determined");
  }
  const locks = (parsed as { readonly locks?: readonly LockEntryWire[] }).locks;
  return [...(locks ?? [])];
}

function releaseExpired(locks: LockEntryWire[]): LockEntryWire[] {
  const now = Date.now();
  return locks.filter((entry) => entry.expiresAt === undefined || entry.expiresAt > now);
}

function footprintToWire(footprint: Footprint): FootprintWire {
  return {
    artifactIds: [...footprint.artifactIds],
    participantIds: [...footprint.participantIds],
    sessionIds: [...footprint.sessionIds],
    capabilityIds: [...footprint.capabilityIds],
    linkIds: [...footprint.linkIds],
  };
}

function footprintFromWire(wire: FootprintWire): Footprint {
  return {
    artifactIds: new Set(wire.artifactIds as ArtifactId[]),
    participantIds: new Set(wire.participantIds as ActorId[]),
    sessionIds: new Set(wire.sessionIds as SessionId[]),
    capabilityIds: new Set(wire.capabilityIds as CapabilityId[]),
    linkIds: new Set(wire.linkIds as LinkId[]),
  };
}
