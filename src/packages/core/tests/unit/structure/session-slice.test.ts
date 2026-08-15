import { describe, expect, it } from "vitest";
import {
  appendRewriteSegment,
  emptyRunHistory,
  sliceRunHistory,
} from "../../../src/structure/trace.js";
import { footprint } from "../../../src/structure/boundary.js";
import { testCoordinationChange } from "../../support/fixtures/change-fixture.js";
import {
  actorId,
  changeId,
  epochId,
  operationTypeId,
  sessionId,
} from "../../../src/primitives/ids.js";
import { snapshotRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";

describe("session history slicing", () => {
  it("includes rewrite segments that only appear in createdSessionRefs", () => {
    const created = sessionId("session-s");
    const change = testCoordinationChange({
      changeId: changeId("chg-delegate"),
      recordedAt: timestamp("2026-08-07T11:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      targets: [],
      initiator: actorRef(actorId("planner-p"), "agent"),
      createdSessionRefs: [created],
    });
    const history = appendRewriteSegment(emptyRunHistory(), change);
    const slice = sliceRunHistory(history, footprint({ sessionIds: [created] }));
    expect(slice).toHaveLength(1);
  });
});
