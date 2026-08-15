import type { Footprint } from "@cantilune/core";
import { overlaps } from "@cantilune/core";
import type { AdmittedId } from "../foundation/brands.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";

interface LockEntry {
  readonly admittedId: AdmittedId;
  readonly footprint: Footprint;
  readonly expiresAt?: number;
}

export class MemoryResourceLockTable implements ResourceLockTable {
  private readonly locks: LockEntry[] = [];

  acquire(admittedId: AdmittedId, footprint: Footprint, leaseMs?: number): boolean {
    this.releaseExpired();
    for (const existing of this.locks) {
      if (overlaps(existing.footprint, footprint)) {
        return false;
      }
    }
    this.locks.push({
      admittedId,
      footprint,
      ...(leaseMs !== undefined ? { expiresAt: Date.now() + leaseMs } : {}),
    });
    return true;
  }

  release(admittedId: AdmittedId): void {
    const index = this.locks.findIndex((entry) => entry.admittedId === admittedId);
    if (index >= 0) {
      this.locks.splice(index, 1);
    }
  }

  isHeld(admittedId: AdmittedId): boolean {
    this.releaseExpired();
    return this.locks.some((entry) => entry.admittedId === admittedId);
  }

  heldLockCount(): number {
    this.releaseExpired();
    return this.locks.length;
  }

  private releaseExpired(): void {
    const now = Date.now();
    for (let i = this.locks.length - 1; i >= 0; i--) {
      const entry = this.locks[i];
      if (entry?.expiresAt !== undefined && entry.expiresAt <= now) {
        this.locks.splice(i, 1);
      }
    }
  }
}
