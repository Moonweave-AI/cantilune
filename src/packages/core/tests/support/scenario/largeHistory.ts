import {
  appendObservationSegment,
  appendRewriteSegment,
  emptyRunHistory,
  type UnvalidatedTrace,
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
import { testCoordinationChange } from "../fixtures/change-fixture.js";

export function buildSerialRewriteHistory(taskCount: number): UnvalidatedTrace {
  let history = emptyRunHistory();
  history = appendObservationSegment(history, {
    sequenceNo: 1,
    source: actorRef(actorId("human-1"), "human"),
    payloadRef: contentRef("content://storm-0"),
    receivedAt: timestamp("2026-08-07T09:00:00Z"),
  });

  for (let index = 0; index < taskCount; index++) {
    const before = snapshotRef(`snap-S${index}`);
    const after = snapshotRef(`snap-S${index + 1}`);
    history = appendRewriteSegment(
      history,
      testCoordinationChange({
        changeId: changeId(`chg-task-${index}`),
        recordedAt: timestamp(`2026-08-07T09:${String(index + 1).padStart(2, "0")}:00Z`),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: before,
        afterRef: after,
        targets: [targetRef("artifact", `task-${index}`)],
        initiator: actorRef(actorId("planner-p"), "agent"),
      }),
    );
  }

  return history;
}

/** Mixed obs + rewrite trace for validateRunHistory stress. */
export function buildStressTrace(taskCount: number, obsEvery = 5): UnvalidatedTrace {
  let history = emptyRunHistory();
  let obsSeq = 1;
  for (let index = 0; index < taskCount; index++) {
    if (index % obsEvery === 0) {
      history = appendObservationSegment(history, {
        sequenceNo: obsSeq,
        source: actorRef(actorId("human-1"), "human"),
        payloadRef: contentRef(`content://stress-obs-${obsSeq}`),
        receivedAt: timestamp(`2026-08-07T09:${String(obsSeq).padStart(2, "0")}:00Z`),
      });
      obsSeq += 1;
    }
    const before = snapshotRef(`snap-S${index}`);
    const after = snapshotRef(`snap-S${index + 1}`);
    history = appendRewriteSegment(
      history,
      testCoordinationChange({
        changeId: changeId(`chg-stress-${index}`),
        recordedAt: timestamp(`2026-08-07T10:${String(index % 60).padStart(2, "0")}:00Z`),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: before,
        afterRef: after,
        targets: [targetRef("artifact", `task-${index}`)],
        initiator: actorRef(actorId("planner-p"), "agent"),
      }),
    );
  }
  return history;
}

export function sliceFootprintForTask(index: number) {
  return footprint({ artifactIds: [artifactId(`task-${index}`)] });
}
