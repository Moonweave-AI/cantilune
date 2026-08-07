import { describe, expect, it } from "vitest";
import { coordinationChange } from "../../src/coordination/coordinationChange.js";
import {
  actorId,
  artifactId,
  capabilityId,
  changeId,
  epochId,
  operationTypeId,
} from "../../src/primitives/ids.js";
import { snapshotRef, targetRef } from "../../src/primitives/refs.js";
import { timestamp } from "../../src/primitives/time.js";
import { actorRef } from "../../src/nodes/participant.js";
import { footprintOfChange } from "../../src/structure/isolation.js";

describe("footprintOfChange delegate case", () => {
  it("includes targets from naming contract §5 delegate", () => {
    const change = coordinationChange({
      changeId: changeId("chg-7f3a"),
      recordedAt: timestamp("2026-08-07T11:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-before"),
      afterRef: snapshotRef("snap-after"),
      targets: [
        targetRef("artifact", "task-T"),
        targetRef("participant", "planner-p"),
        targetRef("participant", "coder-c"),
        targetRef("capability", "write-lock-w"),
      ],
      initiator: actorRef(actorId("planner-p"), "agent"),
    });

    const fp = footprintOfChange(change);
    expect(fp.artifactIds.has(artifactId("task-T"))).toBe(true);
    expect(fp.participantIds.has(actorId("coder-c"))).toBe(true);
    expect(fp.capabilityIds.has(capabilityId("write-lock-w"))).toBe(true);
  });
});
