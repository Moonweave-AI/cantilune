import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  changeId,
  coordinationChange,
  epochId,
  matchBinding,
  operationTypeId,
  snapshotRef,
  timestamp,
  withSnapshotRef,
} from "@cantilune/core";
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";
import { createRaftDurableCoordinator } from "../../../src/memory/raftDurableCoordinator.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";

/**
 * L7 fencing: two writers against one Raft KV.
 * Default CI uses MemoryRaftKv (real MVCC + lease, not a DurableCoordinator mock).
 */
describe("L7 raft fencing", () => {
  const t0 = buildConfigT0();
  const recipe = replayRecipe({
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
    visibility: "external",
  });
  const change = coordinationChange({
    changeId: changeId("chg-raft-fence-1"),
    recordedAt: timestamp("2026-08-16T00:00:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: t0.snapshotRef,
    afterRef: snapshotRef("snap-raft-fence-1"),
    matchBindings: recipe.matchBindings,
    initiator: actorRef(actorId("planner-p"), "agent"),
    visibility: "external",
  });
  const after = withSnapshotRef(t0, snapshotRef("snap-raft-fence-1"));

  it("fences out a stale writer and recovers the head on a later opener", () => {
    const kv = createMemoryRaftKv();
    const stale = createRaftDurableCoordinator({
      kv,
      initial: t0,
      leaseOwner: "writer-stale",
      leaseToken: "token-stale",
    });
    const live = createRaftDurableCoordinator({
      kv,
      leaseOwner: "writer-live",
      leaseToken: "token-live",
    });

    expect(
      stale.commit({
        expectedHead: t0.snapshotRef,
        after,
        change,
        recipe,
      }),
    ).toEqual({ ok: false, reason: "fencing_stale" });

    expect(
      live.commit({
        expectedHead: t0.snapshotRef,
        after,
        change,
        recipe,
      }),
    ).toEqual({ ok: true });
    expect(live.head()).toBe(after.snapshotRef);

    const recovered = createRaftDurableCoordinator({
      kv,
      leaseOwner: "writer-recovered",
      leaseToken: "token-recovered",
    });
    expect(recovered.head()).toBe(after.snapshotRef);
    expect(recovered.get(after.snapshotRef)?.snapshotRef).toBe(after.snapshotRef);
    expect(recovered.changes()).toHaveLength(1);
    expect(
      recovered.compareAndSwapHead(
        t0.snapshotRef,
        withSnapshotRef(t0, snapshotRef("snap-stale-cas")),
      ),
    ).toBe(false);
  });
});
