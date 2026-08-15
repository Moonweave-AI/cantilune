import { describe, expect, it } from "vitest";
import { snapshotRef } from "@cantilune/core";
import { AdmissionRegistry } from "../../../src/admission/admissionRegistry.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";
import { admittedId } from "../../../src/foundation/brands.js";
import { admissionTicket } from "../../../src/admission/admissionTicket.js";
import type { AdmittedRecord } from "../../../src/admission/admittedRecord.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";
import { defaultIntroduceTemplate } from "../../../src/schema/defaultSchema.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import {
  actorId,
  actorRef,
  coordinationIntent,
  emptyFootprint,
  epochId,
  matchBinding,
  operationTypeId,
} from "@cantilune/core";

describe("AdmissionRegistry", () => {
  function sampleRecord(): Omit<AdmittedRecord, "expiresAt"> {
    const before = buildConfigT0();
    return {
      admittedId: admittedId("adm-1"),
      principal: actorRef(actorId("planner-p"), "agent"),
      intent: coordinationIntent(
        actorRef(actorId("planner-p"), "agent"),
        operationTypeId("introduce_artifact"),
        [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      ),
      beforeSnapshot: before,
      beforeRef: before.snapshotRef,
      template: defaultIntroduceTemplate(),
      effectiveFootprint: emptyFootprint(),
      recipe: replayRecipe({
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
        visibility: "external",
      }),
      authorization: [],
      policyRevision: "1",
    };
  }

  it("resolves registered ticket when lock held and head matches", () => {
    const locks = new MemoryResourceLockTable();
    const registry = new AdmissionRegistry(locks);
    const record = sampleRecord();
    locks.acquire(record.admittedId, record.effectiveFootprint);
    const ticket = registry.register(record);
    const resolved = registry.resolveForCommit(ticket, record.beforeRef);
    expect(resolved.ok).toBe(true);
  });

  it("rejects missing expired and head-mismatch tickets", async () => {
    const locks = new MemoryResourceLockTable();
    const registry = new AdmissionRegistry(locks, 5);
    const record = sampleRecord();

    expect(
      registry.resolveForCommit(admissionTicket(admittedId("missing")), record.beforeRef).ok,
    ).toBe(false);

    locks.acquire(record.admittedId, record.effectiveFootprint);
    const expiredTicket = registry.register(record, 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const expired = registry.resolveForCommit(expiredTicket, record.beforeRef);
    expect(expired.ok).toBe(false);
    if (expired.ok) {
      return;
    }
    expect(expired.error.kind).toBe("ticket_expired");

    const ticket2 = registry.register(record);
    locks.release(record.admittedId);
    const noLock = registry.resolveForCommit(ticket2, record.beforeRef);
    expect(noLock.ok).toBe(false);
    if (noLock.ok) {
      return;
    }
    expect(noLock.error.kind).toBe("lock_not_held");

    locks.acquire(record.admittedId, record.effectiveFootprint);
    const ticket3 = registry.register(record);
    const headMismatch = registry.resolveForCommit(ticket3, snapshotRef("snap-other"));
    expect(headMismatch.ok).toBe(false);
    if (headMismatch.ok) {
      return;
    }
    expect(headMismatch.error.kind).toBe("head_mismatch");
  });

  it("purges expired records in activeCount", async () => {
    const locks = new MemoryResourceLockTable();
    const registry = new AdmissionRegistry(locks, 1);
    registry.register(sampleRecord(), 1);
    expect(registry.activeCount()).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(registry.activeCount()).toBe(0);
  });
});
