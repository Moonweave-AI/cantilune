import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { atomicWriteFileSync } from "./atomicWrite.js";
import { withFileLock } from "./fileLock.js";

const LOCKS_FILE = "resource-locks.json";

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

function readLocks(dir: string): LockEntryWire[] {
  const path = join(dir, LOCKS_FILE);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  try {
    const parsed = JSON.parse(raw) as { readonly locks?: readonly LockEntryWire[] };
    return [...(parsed.locks ?? [])];
  } catch (error) {
    // Not silently reset: with the table unreadable there is no way to know what
    // is held, and dropping every lock would admit two writers to one footprint.
    throw new Error(
      `resource lock table at ${path} is unreadable; a holder cannot be determined: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

/**
 * Publishes the table in one step.
 *
 * A truncating write left a partial JSON document behind if the process died
 * mid-write, and every later acquire, release, and liveness check then threw on
 * the unparseable file — so one badly timed crash made all footprints
 * permanently unacquirable.
 */
function writeLocks(dir: string, locks: readonly LockEntryWire[]): void {
  atomicWriteFileSync(join(dir, LOCKS_FILE), JSON.stringify({ locks }));
}

function releaseExpired(locks: LockEntryWire[]): LockEntryWire[] {
  const now = Date.now();
  return locks.filter((entry) => entry.expiresAt === undefined || entry.expiresAt > now);
}

/** Cross-process resource lock table backed by JSON + file lock (same dir as durable bundle). */
export class FileResourceLockTable implements ResourceLockTable {
  constructor(private readonly dir: string) {}

  acquire(admittedId: AdmittedId, footprint: Footprint, leaseMs?: number): boolean {
    return withFileLock(this.dir, () => {
      const active = releaseExpired(readLocks(this.dir));
      for (const existing of active) {
        if (overlaps(footprintFromWire(existing.footprint), footprint)) {
          writeLocks(this.dir, active);
          return false;
        }
      }
      active.push({
        admittedId,
        footprint: footprintToWire(footprint),
        ...(leaseMs !== undefined ? { expiresAt: Date.now() + leaseMs } : {}),
      });
      writeLocks(this.dir, active);
      return true;
    });
  }

  release(admittedId: AdmittedId): void {
    withFileLock(this.dir, () => {
      const active = releaseExpired(readLocks(this.dir)).filter(
        (entry) => entry.admittedId !== admittedId,
      );
      writeLocks(this.dir, active);
    });
  }

  isHeld(admittedId: AdmittedId): boolean {
    return withFileLock(this.dir, () => {
      const active = releaseExpired(readLocks(this.dir));
      writeLocks(this.dir, active);
      return active.some((entry) => entry.admittedId === admittedId);
    });
  }

  heldLockCount(): number {
    return withFileLock(this.dir, () => {
      const active = releaseExpired(readLocks(this.dir));
      writeLocks(this.dir, active);
      return active.length;
    });
  }
}
