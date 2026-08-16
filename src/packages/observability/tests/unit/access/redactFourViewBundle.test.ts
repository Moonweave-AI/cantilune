import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  capabilityId,
  collaborationNamespace,
  collaborationSnapshot,
  decideTranscriptAccess,
  epochId,
  footprint,
  namespaceId,
  participant,
  participantTranscript,
  scopedCapability,
  snapshotRef,
  transcriptAccessRequest,
  transcriptAccessRequestId,
  withCapability,
  withNamespace,
  withParticipant,
  withTranscript,
  withTranscriptAccessRequest,
} from "@cantilune/core";
import { redactFourViewBundle } from "../../../src/access/redactFourViewBundle.js";
import { EXTERNAL_ONLY_LTS_POLICY } from "../../../src/input/observationAccessContext.js";
import { fourViewBundle } from "../../../src/index/fourViewBundle.js";
import { buildEventSpine } from "../../../src/world/eventSpine.js";
import { createEventTagIndex } from "../../../src/foundation/eventTagIndex.js";
import { communicationView } from "../../../src/projection/views/communicationView.js";
import { dependencyView } from "../../../src/projection/views/dependencyView.js";
import { resourceView } from "../../../src/projection/views/resourceView.js";
import { structureView } from "../../../src/projection/views/structureView.js";
import type {
  CommunicationDelta,
  DependencyDelta,
  ResourceDelta,
  StructureDelta,
} from "../../../src/spine/projectionSlice.js";
import type { ObservationAccessContext } from "../../../src/input/observationAccessContext.js";

const tenantA = namespaceId("tenant-a");
const tenantB = namespaceId("tenant-b");
const writer = participant(actorId("writer"), "agent", "active", undefined, tenantA);
const peer = participant(actorId("peer"), "agent", "active", undefined, tenantA);
const outsider = participant(actorId("outsider"), "agent", "active", undefined, tenantB);

function emptyBundle() {
  return fourViewBundle({
    spine: buildEventSpine([]),
    dependency: dependencyView({
      links: [],
      byEvent: createEventTagIndex<DependencyDelta>([]),
    }),
    resource: resourceView({
      capabilities: [],
      byEvent: createEventTagIndex<ResourceDelta>([]),
    }),
    communication: communicationView({
      sessions: [],
      byEvent: createEventTagIndex<CommunicationDelta>([]),
    }),
    structure: structureView({
      composition: { kind: "box" },
      structuralLinks: [],
      byEvent: createEventTagIndex<StructureDelta>([]),
    }),
  });
}

function access(principal: typeof writer, participantIds: string[] = []): ObservationAccessContext {
  return {
    principal: actorRef(principal.actorId, principal.kind),
    scope: footprint({ participantIds: participantIds.map((id) => actorId(id)) }),
    visibilityPolicy: EXTERNAL_ONLY_LTS_POLICY,
  };
}

function worldWithSecret() {
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

describe("redactFourViewBundle", () => {
  it("requires ObservationAccessContext", () => {
    expect(() =>
      redactFourViewBundle(
        emptyBundle(),
        undefined as unknown as ObservationAccessContext,
        worldWithSecret(),
      ),
    ).toThrow(/ObservationAccessContext is required/);
  });

  it("returns full transcripts for the same namespace", () => {
    const redacted = redactFourViewBundle(emptyBundle(), access(peer), worldWithSecret());
    const seen = redacted.transcripts.get(writer.actorId);
    expect(seen?.kind).toBe("full");
    if (seen?.kind === "full") {
      expect(seen.transcript.messages[0]?.content).toBe("secret plan");
    }
    expect(redacted.snapshot.transcripts.get(writer.actorId)?.messages[0]?.content).toBe(
      "secret plan",
    );
    expect(redacted.bundle.spine.events).toEqual([]);
  });

  it("summarizes cross-namespace readers unless a grant exists", () => {
    const redacted = redactFourViewBundle(emptyBundle(), access(outsider), worldWithSecret());
    const seen = redacted.transcripts.get(writer.actorId);
    expect(seen?.kind).toBe("summary");
    if (seen?.kind === "summary") {
      expect(seen.transcript.messages[0]?.content).toContain("chars");
      expect(seen.transcript.messages[0]?.content).not.toContain("secret");
    }
    expect(redacted.snapshot.transcripts.get(writer.actorId)?.messages[0]?.content).not.toContain(
      "secret",
    );
  });

  it("reveals full text after the subject approves a transcript_read grant", () => {
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
    const snap = withTranscriptAccessRequest(worldWithSecret(), request);
    const redacted = redactFourViewBundle(emptyBundle(), access(outsider), snap);
    expect(redacted.transcripts.get(writer.actorId)?.kind).toBe("full");
  });

  it("reveals full text when a transcript_read capability is held", () => {
    const snap = withCapability(
      worldWithSecret(),
      scopedCapability(capabilityId("read-1"), "transcript_read", outsider.actorId, {
        kind: "transcript",
        actorId: writer.actorId,
        namespaceId: tenantA,
      }),
    );
    const redacted = redactFourViewBundle(emptyBundle(), access(outsider), snap);
    expect(redacted.transcripts.get(writer.actorId)?.kind).toBe("full");
  });

  it("filters subjects to the access footprint and reports absent actors", () => {
    const redacted = redactFourViewBundle(
      emptyBundle(),
      access(peer, ["missing-actor"]),
      worldWithSecret(),
    );
    expect(redacted.transcripts.get(writer.actorId)).toBeUndefined();
    expect(redacted.transcripts.get(actorId("missing-actor"))?.kind).toBe("absent");
    expect(redacted.snapshot.transcripts.size).toBe(0);
  });

  it("keeps in-scope transcripts when the footprint lists them", () => {
    const redacted = redactFourViewBundle(
      emptyBundle(),
      access(peer, [writer.actorId]),
      worldWithSecret(),
    );
    expect(redacted.transcripts.get(writer.actorId)?.kind).toBe("full");
  });
});
