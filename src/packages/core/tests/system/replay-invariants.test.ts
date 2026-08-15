import { describe, expect, it } from "vitest";
import { deriveCompositionView } from "../../src/structure/derive.js";
import {
  appendObservationSegment,
  emptyRunHistory,
  sliceRunHistory,
} from "../../src/structure/trace.js";
import { footprint } from "../../src/structure/boundary.js";
import { buildConfigT0, storyActorIds } from "../support/fixtures/standard-story/config-t0.js";
import { buildDelegateChange } from "../support/fixtures/standard-story/delegate-change.js";
import {
  assertBeforeRefChain,
  assertDeriveReadOnly,
  assertEpochConsistent,
  assertNoPayload,
  assertObservationSeparation,
} from "../support/assertions/invariants.js";
import {
  appendObservation,
  withArtifact,
  withCapability,
  withSnapshotRef,
} from "../../src/coordination/collaborationSnapshot.js";
import { testCoordinationChange } from "../support/fixtures/change-fixture.js";
import { artifactId, changeId, epochId, operationTypeId } from "../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../src/primitives/refs.js";
import { timestamp } from "../../src/primitives/time.js";
import { actorRef } from "../../src/nodes/participant.js";
import { scopedCapability } from "../../src/nodes/scopedCapability.js";
import { workArtifact } from "../../src/nodes/workArtifact.js";
import { storyEntityIds } from "../support/fixtures/standard-story/delegate-change.js";
import { simulateCommit } from "../support/harness/simulate-commit.js";

function buildIntroduceChange() {
  return testCoordinationChange({
    changeId: changeId("chg-001"),
    recordedAt: timestamp("2026-08-07T10:05:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapshotRef("snap-S0"),
    afterRef: snapshotRef("snap-S1"),
    targets: [targetRef("artifact", "task-T")],
    initiator: actorRef(storyActorIds.planner, "agent"),
  });
}

describe("replay invariants", () => {
  it("preserves global invariants across observation and rewrite segments", () => {
    const t0 = buildConfigT0();
    const afterObs = appendObservation(t0, {
      source: actorRef(storyActorIds.human, "human"),
      payloadRef: contentRef("content://req-login"),
      receivedAt: timestamp("2026-08-07T10:00:00Z"),
    });
    assertObservationSeparation(t0, afterObs);

    let history = emptyRunHistory();
    history = appendObservationSegment(history, afterObs.auditTail[0]!);

    const introduceChange = buildIntroduceChange();
    const introduceCommit = simulateCommit(afterObs, history, introduceChange, (current, change) =>
      withSnapshotRef(
        withCapability(
          withArtifact(
            current,
            workArtifact(
              storyEntityIds.task,
              "Task",
              contentRef("content://task-T"),
              actorRef(storyActorIds.planner, "agent"),
            ),
          ),
          scopedCapability(storyEntityIds.writeLock, "write_lock", storyActorIds.planner, {
            kind: "artifact",
            artifactId: storyEntityIds.task,
          }),
        ),
        change.afterRef,
      ),
    );

    const delegateChange = buildDelegateChange();
    const changes = [introduceChange, delegateChange];
    for (const change of changes) {
      assertNoPayload(change);
    }
    assertBeforeRefChain(changes);
    assertEpochConsistent(changes);
    assertDeriveReadOnly(introduceCommit.after, introduceCommit.history);

    const derived = deriveCompositionView(introduceCommit.after, introduceCommit.history);
    expect(derived.kind).toBe("box");

    const scoped = sliceRunHistory(
      introduceCommit.history,
      footprint({ artifactIds: [artifactId("task-T")] }),
    );
    expect(scoped.some((segment) => segment.kind === "rewrite")).toBe(true);
  });
});
