import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createFileLeaseCoordinator } from "../../src/adapters/file/fileLeaseCoordinator.js";
import { workerId } from "../../src/foundation/evaluationIds.js";

describe("createFileLeaseCoordinator", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-lease-"));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("acquires, validates, renews, and releases with fencing", async () => {
    const coordinator = createFileLeaseCoordinator(baseDir);
    const grant = await coordinator.acquireLease(workerId("worker-1"), 5_000);
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;

    expect(await coordinator.validateFencingToken(grant.value.leaseId, grant.value.fencingToken)).toBe(
      true,
    );

    const renewed = await coordinator.renewLease(
      grant.value.leaseId,
      grant.value.fencingToken,
      5_000,
    );
    expect(renewed.ok).toBe(true);

    const released = await coordinator.releaseLease(
      grant.value.leaseId,
      grant.value.fencingToken,
    );
    expect(released.ok).toBe(true);
    expect(
      await coordinator.validateFencingToken(grant.value.leaseId, grant.value.fencingToken),
    ).toBe(false);
  });

  it("rejects stale fencing tokens on renew", async () => {
    const coordinator = createFileLeaseCoordinator(baseDir);
    const grant = await coordinator.acquireLease(workerId("worker-2"), 5_000);
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;

    const stale = await coordinator.renewLease(
      grant.value.leaseId,
      "0:deadbeef" as never,
      5_000,
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.violations[0]!.code).toBe("run_fencing_token_stale");
    }
  });

  it("persists leases across coordinator instances", async () => {
    const first = createFileLeaseCoordinator(baseDir);
    const grant = await first.acquireLease(workerId("worker-3"), 10_000);
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;

    const second = createFileLeaseCoordinator(baseDir);
    expect(
      await second.validateFencingToken(grant.value.leaseId, grant.value.fencingToken),
    ).toBe(true);
  });

  it("rejects a second acquire while an unexpired lease is held", async () => {
    const coordinator = createFileLeaseCoordinator(baseDir);
    const first = await coordinator.acquireLease(workerId("worker-held"), 10_000);
    expect(first.ok).toBe(true);

    const second = await coordinator.acquireLease(workerId("worker-challenger"), 10_000);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.violations[0]!.code).toBe("run_lease_held");
    }
  });
});
