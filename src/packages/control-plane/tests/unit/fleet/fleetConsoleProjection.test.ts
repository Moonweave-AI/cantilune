import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  capabilityId,
  collaborationNamespace,
  collaborationSnapshot,
  epochId,
  namespaceId,
  participant,
  participantTranscript,
  scopedCapability,
  sessionId,
  snapshotRef,
  transcriptAccessRequest,
  transcriptAccessRequestId,
  withCapability,
  withNamespace,
  withParticipant,
  withTranscript,
  withTranscriptAccessRequest,
} from "@cantilune/core";
import {
  fleetVisibleTranscript,
  projectFleetConsole,
} from "../../../src/fleet/fleetConsoleProjection.js";

describe("fleet console projection", () => {
  const tenantA = namespaceId("tenant-a");
  const tenantB = namespaceId("tenant-b");
  const writer = actorId("writer");
  const peer = actorId("peer");
  const outsider = actorId("outsider");
  const superAdmin = actorId("fleet-super-admin");

  function world() {
    let snap = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-fleet"),
      epochId: epochId("1"),
    });
    snap = withNamespace(snap, collaborationNamespace(tenantA, "Tenant A", [writer]));
    snap = withNamespace(snap, collaborationNamespace(tenantB, "Tenant B"));
    snap = withParticipant(snap, participant(writer, "agent", "active", undefined, tenantA));
    snap = withParticipant(snap, participant(peer, "agent", "active", undefined, tenantA));
    snap = withParticipant(snap, participant(outsider, "agent", "active", undefined, tenantB));
    snap = withParticipant(snap, participant(superAdmin, "reviewer", "active", undefined, tenantA));
    snap = withParticipant(snap, {
      actorId: actorId("legacy-default"),
      kind: "agent",
      status: "active",
    });
    snap = withTranscript(
      snap,
      participantTranscript(writer, [{ role: "assistant", content: "secret plan" }], {
        namespaceId: tenantA,
      }),
    );
    snap = withTranscript(
      snap,
      participantTranscript(outsider, [{ role: "user", content: "other tenant chat" }], {
        namespaceId: tenantB,
      }),
    );
    snap = withCapability(
      snap,
      scopedCapability(capabilityId("lock-1"), "write_lock", superAdmin, {
        kind: "session",
        sessionId: sessionId("session-1"),
      }),
    );
    return withTranscriptAccessRequest(
      snap,
      transcriptAccessRequest(
        transcriptAccessRequestId("req-pending"),
        actorRef(superAdmin, "reviewer"),
        writer,
        tenantA,
      ),
    );
  }

  it("exposes cross-namespace metadata and redacts full transcripts from super-admin", () => {
    const projection = projectFleetConsole(world(), superAdmin);
    expect(projection.namespaces.map((item) => item.namespaceId)).toEqual([
      namespaceId("default"),
      tenantA,
      tenantB,
    ]);
    const tenantAView = projection.namespaces.find((item) => item.namespaceId === tenantA);
    expect(tenantAView).toEqual({
      namespaceId: tenantA,
      displayName: "Tenant A",
      participantCount: 3,
      transcriptCount: 1,
    });
    const writerView = projection.transcripts.find((item) => item.actorId === writer);
    expect(writerView?.visibility.kind).toBe("summary");
    if (writerView?.visibility.kind === "summary") {
      expect(writerView.visibility.transcript.messages[0]?.content).toContain("chars");
      expect(writerView.visibility.transcript.messages[0]?.content).not.toContain("secret");
    }
  });

  it("keeps same-namespace fleet readers on summaries unless a transcript_read grant exists", () => {
    const snap = world();
    expect(fleetVisibleTranscript(snap, peer, writer).kind).toBe("summary");
    expect(fleetVisibleTranscript(snap, writer, writer).kind).toBe("summary");
    expect(fleetVisibleTranscript(snap, outsider, writer).kind).toBe("summary");
    expect(fleetVisibleTranscript(snap, superAdmin, actorId("missing")).kind).toBe("absent");

    const granted = withCapability(
      snap,
      scopedCapability(capabilityId("read-1"), "transcript_read", superAdmin, {
        kind: "transcript",
        actorId: writer,
        namespaceId: tenantA,
      }),
    );
    const seen = fleetVisibleTranscript(granted, superAdmin, writer);
    expect(seen.kind).toBe("full");
    if (seen.kind === "full") {
      expect(seen.transcript.messages[0]?.content).toBe("secret plan");
    }

    const approved = withTranscriptAccessRequest(
      snap,
      transcriptAccessRequest(
        transcriptAccessRequestId("req-fleet"),
        actorRef(superAdmin, "reviewer"),
        writer,
        tenantA,
        "approved",
        actorRef(writer, "agent"),
      ),
    );
    expect(fleetVisibleTranscript(approved, superAdmin, writer).kind).toBe("full");
  });
});
