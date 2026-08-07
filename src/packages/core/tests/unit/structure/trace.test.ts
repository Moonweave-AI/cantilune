import { describe, expect, it } from "vitest";
import {
  appendObservationSegment,
  appendRewriteSegment,
  composeSerialHistory,
  emptyRunHistory,
  observationSegments,
  rewriteSegments,
} from "../../../src/structure/trace.js";
import { coordinationChange } from "../../../src/coordination/coordinationChange.js";
import {
  actorId,
  changeId,
  epochId,
  operationTypeId,
} from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";

describe("trace", () => {
  it("composes serial histories in order", () => {
    const first = appendObservationSegment(emptyRunHistory(), {
      sequenceNo: 1,
      source: actorRef(actorId("human-1"), "human"),
      payloadRef: contentRef("content://obs-1"),
      receivedAt: timestamp("2026-08-07T09:00:00Z"),
    });
    const second = appendRewriteSegment(emptyRunHistory(), coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T09:01:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      targets: [targetRef("artifact", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
    }));
    const composed = composeSerialHistory(first, second);
    expect(composed).toHaveLength(2);
    expect(observationSegments(composed)).toHaveLength(1);
    expect(rewriteSegments(composed)).toHaveLength(1);
  });
});
