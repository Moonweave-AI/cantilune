import { describe, expect, it } from "vitest";
import {
  appendObservationSegment,
  appendRewriteSegment,
  emptyRunHistory,
  sliceRunHistory,
} from "../../../src/structure/trace.js";
import { footprint } from "../../../src/structure/boundary.js";
import {
  actorId,
  artifactId,
  changeId,
  epochId,
  operationTypeId,
} from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import { coordinationChange } from "../../../src/coordination/coordinationChange.js";

describe("multi-scope history slicing", () => {
  it("returns only segments overlapping each artifact scope", () => {
    let history = emptyRunHistory();
    history = appendObservationSegment(history, {
      sequenceNo: 1,
      source: actorRef(actorId("human-1"), "human"),
      payloadRef: contentRef("content://obs-1"),
      receivedAt: timestamp("2026-08-07T09:00:00Z"),
    });
    history = appendRewriteSegment(
      history,
      coordinationChange({
        changeId: changeId("chg-task-t"),
        recordedAt: timestamp("2026-08-07T09:01:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef("snap-S0"),
        afterRef: snapshotRef("snap-S1"),
        targets: [targetRef("artifact", "task-T")],
        initiator: actorRef(actorId("planner-p"), "agent"),
      }),
    );
    history = appendRewriteSegment(
      history,
      coordinationChange({
        changeId: changeId("chg-task-u"),
        recordedAt: timestamp("2026-08-07T09:02:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef("snap-S1"),
        afterRef: snapshotRef("snap-S2"),
        targets: [targetRef("artifact", "task-U")],
        initiator: actorRef(actorId("planner-p"), "agent"),
      }),
    );

    const sliceT = sliceRunHistory(history, footprint({ artifactIds: [artifactId("task-T")] }));
    const sliceU = sliceRunHistory(history, footprint({ artifactIds: [artifactId("task-U")] }));

    expect(sliceT).toHaveLength(1);
    expect(sliceU).toHaveLength(1);
    expect(sliceT[0]?.kind).toBe("rewrite");
    expect(sliceU[0]?.kind).toBe("rewrite");
    if (sliceT[0]?.kind === "rewrite") {
      expect(sliceT[0].change.changeId).toBe("chg-task-t");
    }
    if (sliceU[0]?.kind === "rewrite") {
      expect(sliceU[0].change.changeId).toBe("chg-task-u");
    }
  });
});
