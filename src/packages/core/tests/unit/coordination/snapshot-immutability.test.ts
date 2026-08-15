import { describe, expect, it } from "vitest";
import { collaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import {
  actorId,
  artifactId,
  capabilityId,
  epochId,
  linkId,
  sessionId,
} from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import type { Participant } from "../../../src/nodes/participant.js";
import type { WorkArtifact } from "../../../src/nodes/workArtifact.js";
import type { CollaborationLink } from "../../../src/nodes/collaborationLink.js";
import type { CommunicationSession } from "../../../src/nodes/communicationSession.js";
import type { ScopedCapability } from "../../../src/nodes/scopedCapability.js";
import type { PolicyContext } from "../../../src/nodes/policyContext.js";
import type { ObservationEntry } from "../../../src/nodes/observationEntry.js";
import type { EntityTombstone } from "../../../src/nodes/entityTombstone.js";
import type { HeartbeatEntry } from "../../../src/coordination/heartbeat.js";
import { assertSnapshotMapsNotAliased } from "../../support/assertions/invariants.js";

describe("CollaborationSnapshot immutable authority", () => {
  it("deeply detaches every caller-owned snapshot field", () => {
    const plannerId = actorId("planner-p");
    const taskId = artifactId("task-T");
    const participantValue: Participant = { actorId: plannerId, kind: "agent", status: "active" };
    const owner = { actorId: plannerId, kind: "agent" as const };
    const artifactValue: WorkArtifact = {
      artifactId: taskId,
      kind: "Task",
      contentRef: contentRef("sha256:task"),
      owner,
      lifecycle: "active",
    };
    const from = { kind: "participant" as const, actorId: plannerId };
    const to = { kind: "artifact" as const, artifactId: taskId };
    const linkValue: CollaborationLink = {
      linkId: linkId("link-1"),
      kind: "supplies",
      from,
      to,
    };
    const sessionParticipants = [plannerId];
    const sessionValue: CommunicationSession = {
      sessionId: sessionId("session-1"),
      controller: plannerId,
      participants: sessionParticipants,
      visibility: "private",
    };
    const capabilityScope = { kind: "artifact" as const, artifactId: taskId };
    const capabilityValue: ScopedCapability = {
      capabilityId: capabilityId("capability-1"),
      kind: "write_lock",
      holder: plannerId,
      scope: capabilityScope,
    };
    const reviewers = ["reviewer-1"];
    const policyContext: PolicyContext = {
      approvalState: { kind: "awaiting_review", reviewers },
      retryState: { kind: "awaiting_feedback", attempt: 2 },
    };
    const observationSource = { actorId: plannerId, kind: "agent" as const };
    const observationValue: ObservationEntry = {
      sequenceNo: 1,
      source: observationSource,
      payloadRef: contentRef("sha256:observation"),
      receivedAt: timestamp("2026-08-13T01:00:00Z"),
    };
    const tombstoneValue: EntityTombstone = {
      entityId: "retired-1",
      entityKind: "link",
      retiredAt: timestamp("2026-08-13T01:01:00Z"),
      reasonRef: "sha256:reason",
    };
    const heartbeatValue: HeartbeatEntry = {
      agentId: plannerId,
      sequenceNo: 1,
      emittedAt: "2026-08-13T01:02:00Z",
      turnCount: 3,
      lastAction: "read_content",
    };

    const participants = new Map([[plannerId, participantValue]]);
    const artifacts = new Map([[taskId, artifactValue]]);
    const links = new Map([[linkValue.linkId, linkValue]]);
    const sessions = new Map([[sessionValue.sessionId, sessionValue]]);
    const capabilities = new Map([[capabilityValue.capabilityId, capabilityValue]]);
    const auditTail = [observationValue];
    const retiredEntities = [tombstoneValue];
    const heartbeatLog = [heartbeatValue];

    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants,
      artifacts,
      links,
      sessions,
      capabilities,
      policyContext,
      auditTail,
      retiredEntities,
      heartbeatLog,
    });

    participants.clear();
    artifacts.clear();
    links.clear();
    sessions.clear();
    capabilities.clear();
    (participantValue as { status: string }).status = "retired";
    (owner as { kind: string }).kind = "human";
    (from as { actorId: ReturnType<typeof actorId> }).actorId = actorId("intruder");
    (to as { artifactId: ReturnType<typeof artifactId> }).artifactId = artifactId("other-task");
    sessionParticipants.push(actorId("intruder"));
    capabilityScope.artifactId = artifactId("other-task");
    reviewers.push("reviewer-2");
    (observationSource as { kind: string }).kind = "human";
    (observationValue as { payloadRef: ReturnType<typeof contentRef> }).payloadRef =
      contentRef("sha256:changed");
    (tombstoneValue as { reasonRef: string }).reasonRef = "sha256:changed";
    (heartbeatValue as { lastAction: string }).lastAction = "done";
    auditTail.push(observationValue);
    retiredEntities.push(tombstoneValue);
    heartbeatLog.push(heartbeatValue);

    expect(snapshot.participants.get(plannerId)).toMatchObject({ status: "active" });
    expect(snapshot.artifacts.get(taskId)?.owner.kind).toBe("agent");
    expect(snapshot.links.get(linkId("link-1"))).toMatchObject({
      from: { actorId: plannerId },
      to: { artifactId: taskId },
    });
    expect(snapshot.sessions.get(sessionId("session-1"))?.participants).toEqual([plannerId]);
    expect(snapshot.capabilities.get(capabilityId("capability-1"))?.scope).toEqual({
      kind: "artifact",
      artifactId: taskId,
    });
    expect(snapshot.policyContext.approvalState).toEqual({
      kind: "awaiting_review",
      reviewers: ["reviewer-1"],
    });
    expect(snapshot.auditTail).toHaveLength(1);
    expect(snapshot.auditTail[0]).toMatchObject({
      source: { kind: "agent" },
      payloadRef: "sha256:observation",
    });
    expect(snapshot.retiredEntities).toEqual([
      expect.objectContaining({ reasonRef: "sha256:reason" }),
    ]);
    expect(snapshot.heartbeatLog).toEqual([
      expect.objectContaining({ lastAction: "read_content" }),
    ]);
    assertSnapshotMapsNotAliased(snapshot, participants);
  });

  it("exposes no collection mutators and freezes nested snapshot values", () => {
    const plannerId = actorId("planner-p");
    const taskId = artifactId("task-T");
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([[plannerId, { actorId: plannerId, kind: "agent", status: "active" }]]),
      artifacts: new Map([
        [
          taskId,
          {
            artifactId: taskId,
            kind: "Task",
            contentRef: contentRef("sha256:task"),
            owner: { actorId: plannerId, kind: "agent" },
            lifecycle: "active",
          },
        ],
      ]),
      policyContext: {
        approvalState: { kind: "awaiting_review", reviewers: ["reviewer-1"] },
        retryState: { kind: "idle" },
      },
      auditTail: [
        {
          sequenceNo: 1,
          source: { actorId: plannerId, kind: "agent" },
          payloadRef: contentRef("sha256:observation"),
          receivedAt: timestamp("2026-08-13T01:00:00Z"),
        },
      ],
    });

    const collection = snapshot.participants as unknown as Record<string, unknown>;
    expect(collection.set).toBeUndefined();
    expect(collection.delete).toBeUndefined();
    expect(collection.clear).toBeUndefined();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.participants)).toBe(true);
    expect(Object.isFrozen(snapshot.participants.get(plannerId))).toBe(true);
    expect(Object.isFrozen(snapshot.artifacts.get(taskId))).toBe(true);
    expect(Object.isFrozen(snapshot.artifacts.get(taskId)?.owner)).toBe(true);
    expect(Object.isFrozen(snapshot.policyContext)).toBe(true);
    expect(Object.isFrozen(snapshot.policyContext.approvalState)).toBe(true);
    if (snapshot.policyContext.approvalState.kind === "awaiting_review") {
      expect(Object.isFrozen(snapshot.policyContext.approvalState.reviewers)).toBe(true);
    }
    expect(Object.isFrozen(snapshot.auditTail)).toBe(true);
    expect(Object.isFrozen(snapshot.auditTail[0])).toBe(true);
    expect(Object.isFrozen(snapshot.auditTail[0]?.source)).toBe(true);

    expect(() => {
      (snapshot.participants.get(plannerId) as { status: string }).status = "retired";
    }).toThrow(TypeError);
    expect(() => {
      (snapshot.auditTail as ObservationEntry[]).push(snapshot.auditTail[0]!);
    }).toThrow(TypeError);
  });
});
