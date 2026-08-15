import { describe, expect, it } from "vitest";
import {
  collaborationSnapshot,
  coordinationChange,
  changeId,
  epochId,
  operationTypeId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
} from "@cantilune/core";
import { observationWorld, resolveSnapshotFromWorld } from "../../../src/world/observationWorld.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";

describe("observationWorld", () => {
  const snapS0 = snapshotRef("snap-S0");
  const snapS1 = snapshotRef("snap-S1");
  const change = coordinationChange({
    changeId: changeId("chg-001"),
    recordedAt: timestamp("2026-08-07T10:00:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapS0,
    afterRef: snapS1,
    matchBindings: [],
    initiator: actorRef(actorId("planner"), "agent"),
    visibility: "external",
  });
  const snapshot = collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") });

  it("indexes changes and resolves terminal snapshot", () => {
    const world = observationWorld({
      snapshotRef: snapS1,
      snapshot,
      validatedHistory: toValidatedHistory(),
      changes: [change],
      sinceRef: snapS0,
    });
    expect(world.orderedChanges).toHaveLength(1);
    expect(world.changeIndex.get(changeId("chg-001"))).toBe(change);
    expect(resolveSnapshotFromWorld(world, snapS1)).toBe(world.snapshot);
    expect(resolveSnapshotFromWorld(world, snapS0)).toBeUndefined();
  });

  it("rejects duplicate changeId in world construction", () => {
    expect(() =>
      observationWorld({
        snapshotRef: snapS1,
        snapshot,
        validatedHistory: toValidatedHistory(),
        changes: [change, change],
        sinceRef: snapS0,
      }),
    ).toThrow(/duplicate changeId/);
  });
});
