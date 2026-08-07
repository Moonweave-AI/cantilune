import { describe, expect, it } from "vitest";
import {
  appendObservation,
  withArtifact,
  withCapability,
  withSnapshotRef,
} from "../../src/coordination/collaborationSnapshot.js";
import { coordinationChange } from "../../src/coordination/coordinationChange.js";
import {
  changeId,
  epochId,
  operationTypeId,
} from "../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../src/primitives/refs.js";
import { timestamp } from "../../src/primitives/time.js";
import { actorRef } from "../../src/nodes/participant.js";
import { scopedCapability, withCapabilityHolder } from "../../src/nodes/scopedCapability.js";
import { workArtifact, withArtifactOwner } from "../../src/nodes/workArtifact.js";
import { buildConfigT0, storyActorIds } from "../support/fixtures/standard-story/config-t0.js";
import {
  buildDelegateChange,
  storyEntityIds,
} from "../support/fixtures/standard-story/delegate-change.js";
import { simulateCommit } from "../support/harness/simulate-commit.js";
import { emptyRunHistory } from "../../src/structure/trace.js";

describe("multi-event chain", () => {
  it("advances snapshot refs through introduce and delegate commits", () => {
    const snapshot = appendObservation(buildConfigT0(), {
      source: actorRef(storyActorIds.human, "human"),
      payloadRef: contentRef("content://req-login"),
      receivedAt: timestamp("2026-08-07T10:00:00Z"),
    });

    const introduce = simulateCommit(
      snapshot,
      emptyRunHistory(),
      coordinationChange({
        changeId: changeId("chg-001"),
        recordedAt: timestamp("2026-08-07T10:05:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef("snap-S0"),
        afterRef: snapshotRef("snap-S1"),
        targets: [targetRef("artifact", "task-T")],
        initiator: actorRef(storyActorIds.planner, "agent"),
      }),
      (current, change) =>
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
            scopedCapability(
              storyEntityIds.writeLock,
              "write_lock",
              storyActorIds.planner,
              { kind: "artifact", artifactId: storyEntityIds.task },
            ),
          ),
          change.afterRef,
        ),
    );

    const delegate = simulateCommit(
      introduce.after,
      introduce.history,
      buildDelegateChange(),
      (current, change) => {
        const task = current.artifacts.get(storyEntityIds.task)!;
        const writeLock = current.capabilities.get(storyEntityIds.writeLock)!;
        return withSnapshotRef(
          withCapability(
            withArtifact(
              current,
              withArtifactOwner(task, actorRef(storyActorIds.coder, "agent")),
            ),
            withCapabilityHolder(writeLock, storyActorIds.coder),
          ),
          change.afterRef,
        );
      },
    );

    expect(introduce.after.snapshotRef).toBe("snap-S1");
    expect(delegate.after.snapshotRef).toBe("snap-S2");
    expect(delegate.history).toHaveLength(2);
  });
});
