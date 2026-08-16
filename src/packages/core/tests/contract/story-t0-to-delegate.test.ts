import { describe, expect, it } from "vitest";
import {
  appendObservation,
  withArtifact,
  withCapability,
  withLink,
  withSession,
  withSnapshotRef,
} from "../../src/coordination/collaborationSnapshot.js";
import { testCoordinationChange } from "../support/fixtures/change-fixture.js";
import { actorId, changeId, epochId, linkId, operationTypeId } from "../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../src/primitives/refs.js";
import { timestamp } from "../../src/primitives/time.js";
import { collaborationLink } from "../../src/nodes/collaborationLink.js";
import { communicationSession } from "../../src/nodes/communicationSession.js";
import { actorRef } from "../../src/nodes/participant.js";
import { scopedCapability, withCapabilityHolder } from "../../src/nodes/scopedCapability.js";
import { withArtifactOwner, workArtifact } from "../../src/nodes/workArtifact.js";
import { appendObservationSegment, emptyRunHistory } from "../../src/structure/trace.js";
import { buildConfigT0, storyActorIds } from "../support/fixtures/standard-story/config-t0.js";
import {
  buildDelegateChange,
  storyEntityIds,
} from "../support/fixtures/standard-story/delegate-change.js";
import {
  assertBeforeRefChain,
  assertEpochConsistent,
  assertNoPayload,
  assertObservationSeparation,
} from "../support/assertions/invariants.js";
import { validateAuditTailMatchesHistory } from "../../src/consistency/index.js";
import { simulateCommit } from "../support/harness/simulate-commit.js";

/**
 * NOT L6 evidence. Unit-level recipe/invariant walk of the naming-contract story.
 * Canonical admit/commit/replay lives in
 * `@cantilune/runtime` `tests/integration/story-t0-to-delegate.test.ts`.
 * `simulateCommit` is a tests-only harness — not a production export.
 */

describe("story T0 to delegate", () => {
  it("follows naming contract §2.4 and §5", () => {
    let snapshot = buildConfigT0();
    let history = emptyRunHistory();

    expect(snapshot.participants.size).toBe(3);
    expect(snapshot.artifacts.size).toBe(0);

    const afterObservation = appendObservation(snapshot, {
      source: actorRef(storyActorIds.human, "human"),
      payloadRef: contentRef("content://req-login"),
      receivedAt: timestamp("2026-08-07T10:00:00Z"),
    });
    assertObservationSeparation(snapshot, afterObservation);
    const obsEntry = afterObservation.auditTail[0];
    expect(obsEntry).toBeDefined();
    history = appendObservationSegment(history, obsEntry!);

    const introduceChange = testCoordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      targets: [targetRef("artifact", "task-T")],
      initiator: actorRef(storyActorIds.planner, "agent"),
      visibility: "external",
    });
    assertNoPayload(introduceChange);

    const introduceCommit = simulateCommit(
      afterObservation,
      history,
      introduceChange,
      (current, change) => {
        const task = workArtifact(
          storyEntityIds.task,
          "Task",
          contentRef("content://task-T"),
          actorRef(storyActorIds.planner, "agent"),
          "active",
        );
        const writeLock = scopedCapability(
          storyEntityIds.writeLock,
          "write_lock",
          storyActorIds.planner,
          { kind: "artifact", artifactId: storyEntityIds.task },
        );
        return withSnapshotRef(
          withCapability(withArtifact(current, task), writeLock),
          change.afterRef,
        );
      },
    );
    snapshot = introduceCommit.after;
    history = introduceCommit.history;

    expect(snapshot.snapshotRef).toBe("snap-S1");
    expect(snapshot.artifacts.has(storyEntityIds.task)).toBe(true);
    expect(snapshot.capabilities.get(storyEntityIds.writeLock)?.holder).toBe(storyActorIds.planner);

    const delegateChange = buildDelegateChange();
    assertNoPayload(delegateChange);
    expect(delegateChange.authorization.length).toBeGreaterThan(0);
    expect(delegateChange.matchBindings.some((b) => b.role === "from")).toBe(true);
    expect(delegateChange.matchBindings.some((b) => b.role === "to")).toBe(true);

    const delegateCommit = simulateCommit(snapshot, history, delegateChange, (current, change) => {
      const task = current.artifacts.get(storyEntityIds.task);
      const writeLock = current.capabilities.get(storyEntityIds.writeLock);
      if (task === undefined || writeLock === undefined) {
        throw new Error("missing task or capability before delegate");
      }

      const coderRef = actorRef(storyActorIds.coder, "agent");
      let next = withSnapshotRef(current, change.afterRef);
      next = withArtifact(next, withArtifactOwner(task, coderRef));
      next = withCapability(next, withCapabilityHolder(writeLock, storyActorIds.coder));
      next = withSession(
        next,
        communicationSession(storyEntityIds.session, storyActorIds.coder, [
          storyActorIds.coder,
          storyActorIds.planner,
        ]),
      );
      next = withLink(
        next,
        collaborationLink(
          linkId("link-waits-1"),
          "waits_for",
          { kind: "participant", actorId: actorId("reviewer-r") },
          { kind: "participant", actorId: storyActorIds.coder },
        ),
      );
      return next;
    });

    snapshot = delegateCommit.after;
    history = delegateCommit.history;
    const changes = [introduceChange, delegateChange];

    assertBeforeRefChain(changes);
    assertEpochConsistent(changes);

    expect(snapshot.snapshotRef).toBe("snap-S2");
    expect(snapshot.artifacts.get(storyEntityIds.task)?.owner.actorId).toBe(storyActorIds.coder);
    expect(snapshot.capabilities.get(storyEntityIds.writeLock)?.holder).toBe(storyActorIds.coder);
    expect(snapshot.sessions.has(storyEntityIds.session)).toBe(true);
    expect(snapshot.links.size).toBe(1);
    expect(history.filter((segment) => segment.kind === "observation")).toHaveLength(1);
    expect(history.filter((segment) => segment.kind === "rewrite")).toHaveLength(2);
    expect(() => validateAuditTailMatchesHistory(snapshot, history)).not.toThrow();
  });
});
