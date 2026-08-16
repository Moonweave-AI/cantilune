import { describe, expect, it } from "vitest";
import {
  collaborationSnapshot,
  withArtifact,
  withCapability,
  withLink,
  withParticipant,
  withPolicyContext,
  withRetiredEntity,
  withSession,
  withSnapshotRef,
  withNamespace,
  withTranscript,
  withTranscriptAccessRequest,
} from "../../../src/coordination/collaborationSnapshot.js";
import {
  actorId,
  artifactId,
  capabilityId,
  epochId,
  linkId,
  sessionId,
  namespaceId,
  transcriptAccessRequestId,
} from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { collaborationLink } from "../../../src/nodes/collaborationLink.js";
import { communicationSession } from "../../../src/nodes/communicationSession.js";
import { entityTombstone } from "../../../src/nodes/entityTombstone.js";
import { actorRef, participant } from "../../../src/nodes/participant.js";
import { emptyPolicyContext, withApprovalState } from "../../../src/nodes/policyContext.js";
import { scopedCapability } from "../../../src/nodes/scopedCapability.js";
import { workArtifact } from "../../../src/nodes/workArtifact.js";
import { collaborationNamespace } from "../../../src/nodes/collaborationNamespace.js";
import { participantTranscript } from "../../../src/nodes/participantTranscript.js";
import { transcriptAccessRequest } from "../../../src/nodes/transcriptAccessRequest.js";

describe("snapshot mutations", () => {
  const base = collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S0"),
    epochId: epochId("42"),
  });

  it("adds entities immutably via with* helpers", () => {
    const p = participant(actorId("planner-p"), "agent");
    const artifact = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      actorRef(p.actorId, "agent"),
    );
    const link = collaborationLink(
      linkId("link-1"),
      "depends_on",
      { kind: "participant", actorId: p.actorId },
      { kind: "artifact", artifactId: artifact.artifactId },
    );
    const session = communicationSession(sessionId("session-s"), p.actorId, [p.actorId]);
    const capability = scopedCapability(capabilityId("write-lock-w"), "write_lock", p.actorId, {
      kind: "artifact",
      artifactId: artifact.artifactId,
    });
    const tombstone = entityTombstone("old-link", "link", timestamp("2026-08-07T12:00:00Z"));

    let snap = base;
    snap = withParticipant(snap, p);
    snap = withArtifact(snap, artifact);
    snap = withLink(snap, link);
    snap = withSession(snap, session);
    snap = withCapability(snap, capability);
    snap = withPolicyContext(snap, withApprovalState(emptyPolicyContext, { kind: "none" }));
    snap = withRetiredEntity(snap, tombstone);
    snap = withSnapshotRef(snap, snapshotRef("snap-S1"));

    expect(snap.participants.size).toBe(1);
    expect(snap.artifacts.size).toBe(1);
    expect(snap.links.size).toBe(1);
    expect(snap.sessions.size).toBe(1);
    expect(snap.capabilities.size).toBe(1);
    expect(snap.retiredEntities).toHaveLength(1);
    expect(snap.snapshotRef).toBe("snap-S1");
    expect(base.participants.size).toBe(0);
  });

  it("stores namespaces, transcripts, and access requests", () => {
    const p = participant(actorId("planner-p"), "agent");
    const ns = collaborationNamespace(namespaceId("tenant-a"), "tenant-a", [p.actorId]);
    const transcript = participantTranscript(p.actorId, [{ role: "user", content: "hello" }], {
      namespaceId: ns.namespaceId,
    });
    const request = transcriptAccessRequest(
      transcriptAccessRequestId("req-1"),
      actorRef(actorId("observer-o"), "human"),
      p.actorId,
      ns.namespaceId,
    );
    let snap = withParticipant(base, p);
    snap = withNamespace(snap, ns);
    snap = withTranscript(snap, transcript);
    snap = withTranscriptAccessRequest(snap, request);
    expect(snap.namespaces.get(ns.namespaceId)?.displayName).toBe("tenant-a");
    expect(snap.transcripts.get(p.actorId)?.messages[0]?.content).toBe("hello");
    expect(snap.transcriptAccessRequests.get(request.requestId)?.status).toBe("requested");
  });
});
