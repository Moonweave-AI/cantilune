import { describe, expect, it } from "vitest";
import { actorId, collaborationSnapshot, epochId, participant, snapshotRef } from "@cantilune/core";
import {
  snapshotWithAdvancedEpoch,
  snapshotsEqualExceptEpochAndRef,
} from "../../../src/engine/epochTransitionSnapshot.js";

describe("epochTransitionSnapshot", () => {
  const planner = participant(actorId("planner-p"), "agent");
  const before = collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S0"),
    epochId: epochId("42"),
    participants: new Map([[planner.actorId, planner]]),
    heartbeatLog: [
      {
        agentId: planner.actorId,
        sequenceNo: 1,
        emittedAt: "2026-08-13T00:00:00Z",
        turnCount: 7,
        lastAction: "write_content",
      },
    ],
  });

  it("advances epoch while preserving the complete world including heartbeat history", () => {
    const after = snapshotWithAdvancedEpoch(before, snapshotRef("snap-E1"), epochId("43"));
    expect(after).toEqual({
      ...before,
      snapshotRef: snapshotRef("snap-E1"),
      epochId: epochId("43"),
    });
    expect(after.heartbeatLog).toEqual(before.heartbeatLog);
  });

  it("detects epoch/ref differences via snapshotsEqualExceptEpochAndRef", () => {
    const after = snapshotWithAdvancedEpoch(before, snapshotRef("snap-E1"), epochId("43"));
    expect(snapshotsEqualExceptEpochAndRef(before, after)).toBe(true);
    expect(snapshotsEqualExceptEpochAndRef(before, before)).toBe(false);

    const droppedHeartbeat = collaborationSnapshot({ ...after, heartbeatLog: [] });
    expect(snapshotsEqualExceptEpochAndRef(before, droppedHeartbeat)).toBe(false);
  });
});
