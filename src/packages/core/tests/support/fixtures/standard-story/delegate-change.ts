import { coordinationChange } from "../../../../src/coordination/coordinationChange.js";
import {
  actorId,
  artifactId,
  capabilityId,
  changeId,
  epochId,
  evidenceId,
  operationTypeId,
  sessionId,
} from "../../../../src/primitives/ids.js";
import {
  contentRef,
  evidenceRef,
  matchBinding,
  snapshotRef,
} from "../../../../src/primitives/refs.js";
import { timestamp } from "../../../../src/primitives/time.js";
import { actorRef } from "../../../../src/nodes/participant.js";

/** Event #2 delegate change (naming contract §5). */
export function buildDelegateChange() {
  return coordinationChange({
    changeId: changeId("chg-7f3a"),
    recordedAt: timestamp("2026-08-07T11:00:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("delegate"),
    beforeRef: snapshotRef("snap-S1"),
    afterRef: snapshotRef("snap-S2"),
    matchBindings: [
      matchBinding("task", "task-T"),
      matchBinding("from", "planner-p"),
      matchBinding("to", "coder-c"),
      matchBinding("capability", "write-lock-w"),
    ],
    initiator: actorRef(actorId("planner-p"), "agent"),
    authorization: [
      evidenceRef(
        evidenceId("planner-authorized-delegation"),
        "policy",
        contentRef("content://auth/delegate-planner"),
      ),
    ],
    createdSessionRefs: [sessionId("session-s")],
    visibility: "external",
  });
}

export const storyEntityIds = {
  task: artifactId("task-T"),
  writeLock: capabilityId("write-lock-w"),
  session: sessionId("session-s"),
} as const;
