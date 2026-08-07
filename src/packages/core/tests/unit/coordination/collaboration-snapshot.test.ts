import { describe, expect, it } from "vitest";
import {
  appendObservation,
  collaborationSnapshot,
  type CollaborationSnapshot,
} from "../../../src/coordination/collaborationSnapshot.js";
import { actorId, artifactId, epochId } from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef, participant } from "../../../src/nodes/participant.js";
import { workArtifact } from "../../../src/nodes/workArtifact.js";

describe("appendObservation", () => {
  it("appends to auditTail without mutating collaboration graph", () => {
    const human = participant(actorId("human-1"), "human");
    const planner = participant(actorId("planner-p"), "agent");
    const before: CollaborationSnapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([
        [human.actorId, human],
        [planner.actorId, planner],
      ]),
      artifacts: new Map([
        [
          artifactId("task-T"),
          workArtifact(
            artifactId("task-T"),
            "Task",
            contentRef("content://task-T"),
            actorRef(planner.actorId, "agent"),
          ),
        ],
      ]),
    });

    const after = appendObservation(before, {
      source: actorRef(human.actorId, "human"),
      payloadRef: contentRef("content://req-login"),
      receivedAt: timestamp("2026-08-07T10:00:00Z"),
    });

    expect(after.auditTail).toHaveLength(1);
    expect(after.auditTail[0]?.sequenceNo).toBe(1);
    expect(after.participants.size).toBe(before.participants.size);
    expect(after.artifacts.size).toBe(before.artifacts.size);
    expect(after.links.size).toBe(0);
    expect(after).not.toBe(before);
  });
});
