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
import { createPostgresDurableCoordinator } from "../../../src/memory/postgresDurableCoordinator.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";
import { createMemorySqlHarness } from "../../support/memorySqlExecutor.js";

/**
 * L7 fencing: two writers against one durable SQL store.
 *
 * Live Postgres is an optional extra (`CANTILUNE_DURABLE_DATABASE_URL`).
 * This suite uses an in-memory `SqlExecutor` so CI stays green without a
 * database. It does not `skipIf` — the shared fake store is the evidence.
 *
 * The second constructor steals the fencing lease; the first writer's
 * subsequent commit is fail-closed. A third opener recovers the committed
 * head after the previous writers are dropped.
 */
describe("L7 postgres fencing", () => {
  const t0 = buildConfigT0();
  const recipe = replayRecipe({
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
    visibility: "external",
  });
  const change = coordinationChange({
    changeId: changeId("chg-fence-1"),
    recordedAt: timestamp("2026-08-16T00:00:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: t0.snapshotRef,
    afterRef: snapshotRef("snap-fence-1"),
    matchBindings: recipe.matchBindings,
    initiator: actorRef(actorId("planner-p"), "agent"),
    visibility: "external",
  });
  const after = withSnapshotRef(t0, snapshotRef("snap-fence-1"));

  it("fences out a stale writer and recovers the head on a later opener", () => {
    const harness = createMemorySqlHarness();
    const stale = createPostgresDurableCoordinator({
      connectionString: "postgres://cantilune/l7",
      executor: harness.executor,
      initial: t0,
      leaseOwner: "writer-stale",
      leaseToken: "token-stale",
    });
    const live = createPostgresDurableCoordinator({
      connectionString: "postgres://cantilune/l7",
      executor: harness.executor,
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

    const recovered = createPostgresDurableCoordinator({
      connectionString: "postgres://cantilune/l7",
      executor: harness.executor,
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
