import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  fencingToken,
  leaseId,
  type FencingToken,
  type LeaseId,
  type WorkerId,
} from "../../foundation/evaluationIds.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { LeaseCoordinator, LeaseGrant } from "../../ports/executionPorts.js";

interface LeaseRecord {
  readonly leaseId: string;
  readonly workerId: string;
  readonly fencingToken: string;
  readonly fencingSeq: number;
  readonly expiresAtMs: number;
  readonly expiresAt: string;
}

function validateSegment(segment: string): boolean {
  return /^[a-zA-Z0-9\-_.]+$/.test(segment) && !segment.includes("..");
}

async function withLeaseLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  await fs.mkdir(dir, { recursive: true });
  const lockPath = path.join(dir, ".lease.lock");
  const handle = await fs.open(lockPath, "a+");
  try {
    // Exclusive advisory lock via O_EXCL sidecar when flock is unavailable:
    // serialize writers with a short spin on rename of a lock holder file.
    const holder = path.join(dir, `.lease.lock.holder.${process.pid}.${randomUUID()}`);
    const deadline = Date.now() + 5_000;
    for (;;) {
      try {
        await fs.writeFile(holder, String(Date.now()), { flag: "wx" });
        break;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        if (Date.now() > deadline) {
          throw new Error("lease lock acquisition timed out");
        }
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    try {
      return await fn();
    } finally {
      await fs.unlink(holder).catch(() => {});
    }
  } finally {
    await handle.close();
  }
}

async function readLeases(filePath: string): Promise<Map<string, LeaseRecord>> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as { leases?: LeaseRecord[]; nextFencingSeq?: number };
    const map = new Map<string, LeaseRecord>();
    for (const lease of parsed.leases ?? []) {
      map.set(lease.leaseId, lease);
    }
    return map;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
}

async function writeLeases(
  filePath: string,
  leases: Map<string, LeaseRecord>,
  nextFencingSeq: number,
): Promise<void> {
  const payload = JSON.stringify(
    { nextFencingSeq, leases: [...leases.values()] },
    null,
    2,
  );
  const tmp = `${filePath}.tmp.${Date.now()}.${randomUUID()}`;
  await fs.writeFile(tmp, payload);
  await fs.rename(tmp, filePath);
}

async function readNextSeq(filePath: string): Promise<number> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as { nextFencingSeq?: number };
    return typeof parsed.nextFencingSeq === "number" ? parsed.nextFencingSeq : 1;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 1;
    throw err;
  }
}

function mintFencingToken(seq: number): FencingToken {
  const hex = createHash("sha256").update(`fence:${seq}`).digest("hex").slice(0, 32);
  return fencingToken(`${seq}:${hex}`);
}

/**
 * File-durable lease coordinator with monotonic fencing tokens.
 * Required on the file-backed evaluation engine path (ADR-0011).
 */
export function createFileLeaseCoordinator(baseDir: string): LeaseCoordinator {
  const dir = path.join(baseDir, "leases");
  const filePath = path.join(dir, "leases.json");

  return {
    async acquireLease(
      workerId: WorkerId,
      durationMs: number,
    ): Promise<EvaluationResult<LeaseGrant>> {
      if (!validateSegment(workerId as string)) {
        return violations([
          violation("invalid_input", "workerId", `Invalid worker id: ${workerId as string}`),
        ]);
      }
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return violations([
          violation("invalid_input", "durationMs", "durationMs must be a positive number"),
        ]);
      }

      try {
        return await withLeaseLock(dir, async () => {
          const now = Date.now();
          const leases = await readLeases(filePath);
          let nextSeq = await readNextSeq(filePath);

          // Drop expired leases so fencing space remains usable across recovery.
          for (const [id, lease] of leases) {
            if (lease.expiresAtMs <= now) leases.delete(id);
          }

          if (leases.size > 0) {
            const holder = [...leases.values()][0];
            return violations([
              violation(
                "run_lease_held",
                "lease.acquire",
                `An unexpired evaluation lease is already held by ${holder?.workerId ?? "another worker"}`,
              ),
            ]);
          }

          const id = leaseId(randomUUID());
          const token = mintFencingToken(nextSeq);
          nextSeq += 1;
          const expiresAtMs = now + durationMs;
          const record: LeaseRecord = {
            leaseId: id as string,
            workerId: workerId as string,
            fencingToken: token as string,
            fencingSeq: nextSeq - 1,
            expiresAtMs,
            expiresAt: new Date(expiresAtMs).toISOString(),
          };
          leases.set(record.leaseId, record);
          await writeLeases(filePath, leases, nextSeq);
          return ok({
            leaseId: id,
            fencingToken: token,
            expiresAt: record.expiresAt,
          });
        });
      } catch (err) {
        return violations([
          violation(
            "store_write_failed",
            "lease.acquire",
            `Acquire failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        ]);
      }
    },

    async renewLease(
      id: LeaseId,
      token: FencingToken,
      durationMs: number,
    ): Promise<EvaluationResult<LeaseGrant>> {
      if (!validateSegment(id as string)) {
        return violations([violation("invalid_input", "leaseId", `Invalid lease id: ${id}`)]);
      }
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return violations([
          violation("invalid_input", "durationMs", "durationMs must be a positive number"),
        ]);
      }

      try {
        return await withLeaseLock(dir, async () => {
          const now = Date.now();
          const leases = await readLeases(filePath);
          const nextSeq = await readNextSeq(filePath);
          const existing = leases.get(id as string);
          if (existing === undefined || existing.expiresAtMs <= now) {
            return violations([
              violation(
                "run_lease_expired",
                "leaseId",
                `Lease not found or expired: ${id as string}`,
              ),
            ]);
          }
          if (existing.fencingToken !== (token as string)) {
            return violations([
              violation(
                "run_fencing_token_stale",
                "fencingToken",
                "Fencing token does not match current lease holder",
              ),
            ]);
          }
          const expiresAtMs = now + durationMs;
          const renewed: LeaseRecord = {
            ...existing,
            expiresAtMs,
            expiresAt: new Date(expiresAtMs).toISOString(),
          };
          leases.set(renewed.leaseId, renewed);
          await writeLeases(filePath, leases, nextSeq);
          return ok({
            leaseId: id,
            fencingToken: token,
            expiresAt: renewed.expiresAt,
          });
        });
      } catch (err) {
        return violations([
          violation(
            "store_write_failed",
            "lease.renew",
            `Renew failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        ]);
      }
    },

    async releaseLease(id: LeaseId, token: FencingToken): Promise<EvaluationResult<void>> {
      try {
        return await withLeaseLock(dir, async () => {
          const leases = await readLeases(filePath);
          const nextSeq = await readNextSeq(filePath);
          const existing = leases.get(id as string);
          if (existing === undefined) return ok(undefined);
          if (existing.fencingToken !== (token as string)) {
            return violations([
              violation(
                "run_fencing_token_stale",
                "fencingToken",
                "Fencing token does not match current lease holder",
              ),
            ]);
          }
          leases.delete(id as string);
          await writeLeases(filePath, leases, nextSeq);
          return ok(undefined);
        });
      } catch (err) {
        return violations([
          violation(
            "store_write_failed",
            "lease.release",
            `Release failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        ]);
      }
    },

    async validateFencingToken(id: LeaseId, token: FencingToken): Promise<boolean> {
      try {
        const leases = await readLeases(filePath);
        const existing = leases.get(id as string);
        if (existing === undefined) return false;
        if (existing.expiresAtMs <= Date.now()) return false;
        return existing.fencingToken === (token as string);
      } catch {
        return false;
      }
    },
  };
}
