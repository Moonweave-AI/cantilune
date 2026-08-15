import { describe, expect, it } from "vitest";
import { testCoordinationChange } from "../support/fixtures/change-fixture.js";
import {
  actorId,
  artifactId,
  changeId,
  epochId,
  operationTypeId,
} from "../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../src/primitives/refs.js";
import { timestamp } from "../../src/primitives/time.js";
import { actorRef } from "../../src/nodes/participant.js";
import { footprint } from "../../src/structure/boundary.js";
import {
  appendObservationSegment,
  appendRewriteSegment,
  emptyRunHistory,
  sliceRunHistory,
} from "../../src/structure/trace.js";

describe("trace slice", () => {
  it("extracts segments overlapping footprint scope", () => {
    let history = emptyRunHistory();
    history = appendObservationSegment(history, {
      sequenceNo: 1,
      source: actorRef(actorId("human-1"), "human"),
      payloadRef: contentRef("content://obs-1"),
      receivedAt: timestamp("2026-08-07T09:00:00Z"),
    });
    history = appendRewriteSegment(
      history,
      testCoordinationChange({
        changeId: changeId("chg-001"),
        recordedAt: timestamp("2026-08-07T09:01:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef("snap-S0"),
        afterRef: snapshotRef("snap-S1"),
        targets: [targetRef("artifact", "task-T")],
        initiator: actorRef(actorId("planner-p"), "agent"),
      }),
    );

    const scope = footprint({ artifactIds: [artifactId("task-T")] });
    const sliced = sliceRunHistory(history, scope);
    expect(sliced).toHaveLength(1);
    expect(sliced[0]?.kind).toBe("rewrite");
  });
});
