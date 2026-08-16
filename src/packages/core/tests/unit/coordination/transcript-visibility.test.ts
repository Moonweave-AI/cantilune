import { describe, expect, it } from "vitest";
import {
  collaborationSnapshot,
  withCapability,
  withNamespace,
  withParticipant,
  withTranscript,
  withTranscriptAccessRequest,
} from "../../../src/coordination/collaborationSnapshot.js";
import { visibleTranscript } from "../../../src/coordination/transcriptVisibility.js";
import { actorId, capabilityId, epochId, namespaceId, transcriptAccessRequestId } from "../../../src/primitives/ids.js";
import { snapshotRef } from "../../../src/primitives/refs.js";
import { actorRef, participant } from "../../../src/nodes/participant.js";
import { collaborationNamespace } from "../../../src/nodes/collaborationNamespace.js";
import { participantTranscript } from "../../../src/nodes/participantTranscript.js";
import { decideTranscriptAccess, transcriptAccessRequest } from "../../../src/nodes/transcriptAccessRequest.js";
import { scopedCapability } from "../../../src/nodes/scopedCapability.js";

describe("visibleTranscript", () => {
  const tenantA = namespaceId("tenant-a");
  const tenantB = namespaceId("tenant-b");
  const writer = participant(actorId("writer"), "agent", "active", undefined, tenantA);
  const peer = participant(actorId("peer"), "agent", "active", undefined, tenantA);
  const outsider = participant(actorId("outsider"), "agent", "active", undefined, tenantB);

  function world() {
    let snap = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("1"),
    });
    snap = withNamespace(snap, collaborationNamespace(tenantA, "A"));
    snap = withNamespace(snap, collaborationNamespace(tenantB, "B"));
    snap = withParticipant(snap, writer);
    snap = withParticipant(snap, peer);
    snap = withParticipant(snap, outsider);
    return withTranscript(
      snap,
      participantTranscript(writer.actorId, [{ role: "assistant", content: "secret plan" }], {
        namespaceId: tenantA,
      }),
    );
  }

  it("lets same-namespace peers read the full transcript", () => {
    const seen = visibleTranscript(world(), peer.actorId, writer.actorId);
    expect(seen.kind).toBe("full");
    if (seen.kind === "full") {
      expect(seen.transcript.messages[0]?.content).toBe("secret plan");
    }
  });

  it("redacts cross-namespace readers to a summary", () => {
    const seen = visibleTranscript(world(), outsider.actorId, writer.actorId);
    expect(seen.kind).toBe("summary");
    if (seen.kind === "summary") {
      expect(seen.transcript.messages[0]?.content).toContain("chars");
      expect(seen.transcript.messages[0]?.content).not.toContain("secret");
    }
  });

  it("reveals full text after the subject actor approves", () => {
    const request = decideTranscriptAccess(
      transcriptAccessRequest(
        transcriptAccessRequestId("req-1"),
        actorRef(outsider.actorId, "agent"),
        writer.actorId,
        tenantA,
      ),
      actorRef(writer.actorId, "agent"),
      "approved",
    );
    const snap = withTranscriptAccessRequest(world(), request);
    const seen = visibleTranscript(snap, outsider.actorId, writer.actorId);
    expect(seen.kind).toBe("full");
  });

  it("reveals full text when a transcript_read capability is held", () => {
    const snap = withCapability(
      world(),
      scopedCapability(capabilityId("read-1"), "transcript_read", outsider.actorId, {
        kind: "transcript",
        actorId: writer.actorId,
        namespaceId: tenantA,
      }),
    );
    const seen = visibleTranscript(snap, outsider.actorId, writer.actorId);
    expect(seen.kind).toBe("full");
  });
});
