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
import { createEtcdRaftKv } from "../../../src/memory/etcdRaftKv.js";
import { createRaftDurableCoordinator } from "../../../src/memory/raftDurableCoordinator.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";

/**
 * Live official etcd L7. Not part of the default `vitest run` include set.
 * CI runs `test:raft-live`. Missing endpoints is an explicit failure — never skipIf.
 */
const endpoints = process.env.CANTILUNE_RAFT_ENDPOINTS?.split(",")
  .map((part) => part.trim())
  .filter((part) => part.length > 0);
if (endpoints === undefined || endpoints.length === 0) {
  throw new Error(
    "CANTILUNE_RAFT_ENDPOINTS is required for raft-live-fencing (ADR-0029). CI provides etcd; locally set the endpoints or run the default suite.",
  );
}

describe("L7 live etcd Raft fencing", () => {
  const t0 = buildConfigT0();
  const recipe = replayRecipe({
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
    visibility: "external",
  });
  const stamp = Date.now();
  const change = coordinationChange({
    changeId: changeId(`chg-live-raft-${String(stamp)}`),
    recordedAt: timestamp("2026-08-16T00:00:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: t0.snapshotRef,
    afterRef: snapshotRef(`snap-live-raft-${String(stamp)}`),
    matchBindings: recipe.matchBindings,
    initiator: actorRef(actorId("planner-p"), "agent"),
    visibility: "external",
  });
  const after = withSnapshotRef(t0, change.afterRef);

  it("fences out a stale writer against official etcd", () => {
    const kv = createEtcdRaftKv({ endpoints });
    const namespace = `cantilune_live_${String(stamp)}`;
    const stale = createRaftDurableCoordinator({
      kv,
      namespace,
      initial: t0,
      leaseOwner: "writer-stale",
      leaseToken: "token-stale",
    });
    const live = createRaftDurableCoordinator({
      kv,
      namespace,
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
    kv.close?.();
  });
});
