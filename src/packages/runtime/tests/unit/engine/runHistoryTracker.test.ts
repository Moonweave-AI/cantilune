import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  changeId,
  coordinationChange,
  epochId,
  operationTypeId,
  snapshotRef,
  timestamp,
} from "@cantilune/core";
import { RunHistoryTracker } from "../../../src/engine/runHistoryTracker.js";

describe("RunHistoryTracker", () => {
  it("records observations changes and resets", () => {
    const tracker = new RunHistoryTracker();
    expect(tracker.current()).toHaveLength(0);
    tracker.recordChange(
      coordinationChange({
        changeId: changeId("chg-1"),
        recordedAt: timestamp("2026-08-07T10:00:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef("snap-S0"),
        afterRef: snapshotRef("snap-S1"),
        matchBindings: [],
        initiator: actorRef(actorId("planner-p"), "agent"),
        visibility: "external",
      }),
    );
    expect(tracker.current()).toHaveLength(1);
    tracker.reset();
    expect(tracker.current()).toHaveLength(0);
  });
});
