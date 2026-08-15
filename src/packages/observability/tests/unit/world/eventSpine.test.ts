import { describe, expect, it } from "vitest";
import {
  collaborationSnapshot,
  coordinationChange,
  epochId,
  changeId,
  operationTypeId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
} from "@cantilune/core";
import { buildEventSpine, sourceEventFromChange } from "../../../src/world/eventSpine.js";
import { observationWorld } from "../../../src/world/observationWorld.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";

describe("eventSpine", () => {
  it("builds ordered source events from committed changes", () => {
    const change = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });
    const spine = buildEventSpine([change]);
    expect(spine.events).toHaveLength(1);
    expect(sourceEventFromChange(change).change.changeId).toBe("chg-001");
  });

  it("indexes changes on observation world", () => {
    const snap = snapshotRef("snap-S0");
    const world = observationWorld({
      snapshotRef: snap,
      snapshot: collaborationSnapshot({ snapshotRef: snap, epochId: epochId("42") }),
      validatedHistory: toValidatedHistory(),
      changes: [],
      sinceRef: snap,
    });
    expect(world.changeIndex.size).toBe(0);
    expect(world.orderedChanges).toHaveLength(0);
  });
});
