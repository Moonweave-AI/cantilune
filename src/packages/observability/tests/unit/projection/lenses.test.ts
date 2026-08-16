import { describe, expect, it } from "vitest";
import {
  collaborationLink,
  collaborationSnapshot,
  communicationSession,
  coordinationChange,
  scopedCapability,
  workArtifact,
  withArtifact,
  withCapability,
  withLink,
  withSession,
  withSnapshotRef,
  actorId,
  artifactId,
  capabilityId,
  changeId,
  epochId,
  linkId,
  operationTypeId,
  sessionId,
  snapshotRef,
  timestamp,
  actorRef,
  contentRef,
  targetRef,
} from "@cantilune/core";
import { eventTagFromChange } from "../../../src/foundation/eventTag.js";
import { interpretCommunicationDelta } from "../../../src/projection/lenses/communicationLens.js";
import { interpretDependencyDelta } from "../../../src/projection/lenses/dependencyLens.js";
import { interpretResourceDelta } from "../../../src/projection/lenses/resourceLens.js";
import {
  interpretStructureDelta,
  structureStepFromChange,
} from "../../../src/projection/lenses/structureLens.js";

describe("projection lenses", () => {
  const snapS0 = snapshotRef("snap-S0");
  const snapS1 = snapshotRef("snap-S1");
  const task = artifactId("task-T");
  const lock = capabilityId("write-lock-w");
  const planner = actorId("planner-p");
  const coder = actorId("coder-c");
  const reviewer = actorId("reviewer-r");

  function baseChange(
    operation: string,
    extra?: Partial<Parameters<typeof coordinationChange>[0]>,
  ) {
    return coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId(operation),
      beforeRef: snapS0,
      afterRef: snapS1,
      matchBindings: [],
      initiator: actorRef(planner, "agent"),
      visibility: "external",
      ...extra,
    });
  }

  it("resource lens reports capability holder change on delegate", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const artifact = workArtifact(
      task,
      "Task",
      contentRef("content://task"),
      actorRef(planner, "agent"),
    );
    const capability = scopedCapability(lock, "write_lock", planner, {
      kind: "artifact",
      artifactId: task,
    });
    let after = withArtifact(before, artifact);
    after = withCapability(after, capability);
    after = withSnapshotRef(after, snapS1);

    const change = baseChange("introduce_artifact");
    const delta = interpretResourceDelta(eventTagFromChange(change), before, after);
    expect(delta.updatedCapabilities).toHaveLength(1);
    expect(delta.updatedCapabilities[0]?.holder).toBe(planner);

    const delegatedCap = scopedCapability(lock, "write_lock", coder, {
      kind: "artifact",
      artifactId: task,
    });
    const delegatedAfter = withCapability(after, delegatedCap);
    const delegateChange = baseChange("delegate");
    const delegateDelta = interpretResourceDelta(
      eventTagFromChange(delegateChange),
      after,
      delegatedAfter,
    );
    expect(delegateDelta.updatedCapabilities[0]?.holder).toBe(coder);
  });

  it("dependency lens reports waits_for link addition and removal", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const link = collaborationLink(
      linkId("link-waits-1"),
      "waits_for",
      { kind: "participant", actorId: reviewer },
      { kind: "participant", actorId: coder },
    );
    const after = withLink(withSnapshotRef(before, snapS1), link);
    const change = baseChange("delegate");

    const added = interpretDependencyDelta(eventTagFromChange(change), before, after);
    expect(added.addedLinks).toHaveLength(1);
    expect(added.addedLinks[0]?.kind).toBe("waits_for");

    const removed = interpretDependencyDelta(eventTagFromChange(change), after, before);
    expect(removed.removedLinkIds).toEqual(["link-waits-1"]);
  });

  it("communication lens reports session open, close, and in-place update", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const session = communicationSession(sessionId("session-s"), coder, [coder, planner]);
    const after = withSession(withSnapshotRef(before, snapS1), session);
    const change = baseChange("delegate", { createdSessionRefs: [session.sessionId] });

    const opened = interpretCommunicationDelta(eventTagFromChange(change), before, after);
    expect(opened.openedSessions).toHaveLength(1);
    expect(opened.closedSessionIds).toHaveLength(0);
    expect(opened.updatedSessions).toHaveLength(0);

    const closed = interpretCommunicationDelta(eventTagFromChange(change), after, before);
    expect(closed.closedSessionIds).toEqual(["session-s"]);

    const updatedBefore = withSession(withSnapshotRef(before, snapS1), session);
    const updatedAfter = withSession(
      withSnapshotRef(before, snapS1),
      communicationSession(sessionId("session-s"), planner, [coder, planner, reviewer]),
    );
    const updated = interpretCommunicationDelta(
      eventTagFromChange(baseChange("delegate")),
      updatedBefore,
      updatedAfter,
    );
    expect(updated.updatedSessions).toHaveLength(1);
    expect(updated.openedSessions).toHaveLength(0);
  });

  it("resource lens reports removed capabilities", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const capability = scopedCapability(lock, "write_lock", planner, {
      kind: "artifact",
      artifactId: task,
    });
    const withCap = withCapability(withSnapshotRef(before, snapS1), capability);
    const after = collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") });

    const delta = interpretResourceDelta(
      eventTagFromChange(baseChange("delegate")),
      withCap,
      after,
    );
    expect(delta.removedCapabilityIds).toEqual([lock]);
  });

  it("structure lens maps create_session to nest and fork_branch to parallel", () => {
    const nestChange = baseChange("create_session", {
      changeId: changeId("chg-nest"),
      createdSessionRefs: [sessionId("session-n")],
      targets: [targetRef("participant", planner), targetRef("participant", coder)],
    });
    const nestStep = structureStepFromChange(nestChange);
    expect(nestStep.kind).toBe("nest");
    if (nestStep.kind === "nest") {
      expect(nestStep.inner.kind).toBe("parallel");
    }

    const forkChange = baseChange("fork_branch", {
      changeId: changeId("chg-fork"),
      targets: [targetRef("participant", planner), targetRef("participant", coder)],
    });
    const forkStep = structureStepFromChange(forkChange);
    expect(forkStep.kind).toBe("parallel");

    const delta = interpretStructureDelta(
      eventTagFromChange(baseChange("introduce_artifact")),
      collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") }),
      collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") }),
      baseChange("introduce_artifact"),
    );
    expect(delta.step.kind).toBe("box");
  });

  it("communication lens attributes create_session opened sessions from committed change", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const session = communicationSession(sessionId("session-s"), coder, [coder, planner]);
    const after = withSession(withSnapshotRef(before, snapS1), session);
    const change = baseChange("create_session", { createdSessionRefs: [session.sessionId] });
    const opened = interpretCommunicationDelta(eventTagFromChange(change), before, after, change);
    expect(opened.openedSessions).toHaveLength(1);
    expect(opened.openedSessions[0]?.sessionId).toBe(session.sessionId);
  });
});
