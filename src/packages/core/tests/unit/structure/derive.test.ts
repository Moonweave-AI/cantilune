import { describe, expect, it } from "vitest";
import {
  deriveCompositionView,
  deriveDiagnosticSummary,
  diagnosticStepFromChange,
  deriveSnapshotStats,
  deriveSnapshotStatsWithHistory,
} from "../../../src/structure/derive.js";
import { appendRewriteSegment, emptyRunHistory } from "../../../src/structure/trace.js";
import { collaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import { testCoordinationChange } from "../../support/fixtures/change-fixture.js";
import { actorId, changeId, epochId, operationTypeId } from "../../../src/primitives/ids.js";
import { snapshotRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef, participant } from "../../../src/nodes/participant.js";

describe("derive", () => {
  it("returns an empty box for an empty snapshot", () => {
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-empty"),
      epochId: epochId("1"),
    });
    expect(deriveCompositionView(snapshot, emptyRunHistory())).toEqual({ kind: "box" });
  });

  it("returns a single participant box when only one is registered", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([[planner.actorId, planner]]),
    });
    expect(deriveCompositionView(snapshot, emptyRunHistory())).toEqual({
      kind: "box",
      participantId: planner.actorId,
    });
  });

  it("derives parallel boxes for multiple participants without history", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const coder = participant(actorId("coder-c"), "agent");
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([
        [planner.actorId, planner],
        [coder.actorId, coder],
      ]),
    });
    const view = deriveCompositionView(snapshot, emptyRunHistory());
    expect(view.kind).toBe("parallel");
    if (view.kind === "parallel") {
      expect(view.parts).toHaveLength(2);
    }
  });

  it("derives serial boxes from rewrite history", () => {
    const change = testCoordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T09:01:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      targets: [targetRef("artifact", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
    });
    const history = appendRewriteSegment(emptyRunHistory(), change);
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S1"),
      epochId: epochId("42"),
    });
    const view = deriveCompositionView(snapshot, history);
    expect(view).toEqual({ kind: "box", artifactId: "task-T" });
  });

  it("derives nest view for create_session changes", () => {
    const change = testCoordinationChange({
      changeId: changeId("chg-session"),
      recordedAt: timestamp("2026-08-07T09:01:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("create_session"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      targets: [targetRef("participant", "planner-p"), targetRef("participant", "coder-c")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      createdSessionRefs: ["session-s" as never],
    });
    const view = diagnosticStepFromChange(change);
    expect(view.kind).toBe("nest");
  });

  it("derives parallel boxes for fork_branch", () => {
    const change = testCoordinationChange({
      changeId: changeId("chg-fork"),
      recordedAt: timestamp("2026-08-07T09:01:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      targets: [targetRef("participant", "planner-p"), targetRef("participant", "coder-c")],
      initiator: actorRef(actorId("planner-p"), "agent"),
    });
    const view = diagnosticStepFromChange(change);
    expect(view.kind).toBe("parallel");
  });

  it("returns serial composition for multi-step history", () => {
    const change1 = testCoordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T09:01:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      targets: [targetRef("artifact", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
    });
    const change2 = testCoordinationChange({
      changeId: changeId("chg-002"),
      recordedAt: timestamp("2026-08-07T09:02:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      targets: [targetRef("artifact", "task-T"), targetRef("participant", "coder-c")],
      initiator: actorRef(actorId("planner-p"), "agent"),
    });
    const history = appendRewriteSegment(appendRewriteSegment(emptyRunHistory(), change1), change2);
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S2"),
      epochId: epochId("42"),
    });
    const view = deriveDiagnosticSummary(snapshot, history);
    expect(view.kind).toBe("serial");
  });

  it("counts snapshot entities and history rewrites", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([[planner.actorId, planner]]),
    });
    const change = testCoordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T09:01:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      targets: [targetRef("artifact", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
    });
    const history = appendRewriteSegment(emptyRunHistory(), change);
    expect(deriveSnapshotStats(snapshot)).toMatchObject({
      participants: 1,
      changes: 0,
      observations: 0,
    });
    expect(deriveSnapshotStatsWithHistory(snapshot, history)).toMatchObject({
      participants: 1,
      changes: 1,
    });
  });
});
