import { describe, expect, it } from "vitest";
import {
  ACTOR_KINDS,
  ARTIFACT_LIFECYCLES,
  CAPABILITY_KINDS,
  LINK_KINDS,
  PARTICIPATION_STATUSES,
  RETIRED_ENTITY_KINDS,
  SESSION_VISIBILITIES,
  actorId,
  actorRef,
  artifactId,
  capabilityId,
  collaborationLink,
  collaborationSnapshot,
  communicationSession,
  contentRef,
  entityTombstone,
  epochId,
  linkId,
  observationEntry,
  participant,
  scopedCapability,
  sessionId,
  snapshotRef,
  timestamp,
  workArtifact,
} from "@cantilune/core";
import type { CollaborationSnapshot } from "@cantilune/core";
import { decodeSnapshot, encodeSnapshot } from "../../../src/codec/snapshotCodec.js";
import { snapshotsCanonicallyEqual } from "../../../src/codec/canonicalSnapshot.js";
import { parseSnapshotWire } from "../../../src/codec/wireValidation.js";

const REF = contentRef("sha256:aa");
const AT = timestamp("2026-08-13T09:00:00Z");

/**
 * One snapshot holding every legal value of every enumerated field. Two of the
 * wire validator's enum lists had silently fallen behind core, so the store
 * accepted commits it could not read back and the durable world became
 * unloadable on the next head read.
 */
function saturatedSnapshot(): CollaborationSnapshot {
  const participants = new Map(
    PARTICIPATION_STATUSES.flatMap((status) =>
      ACTOR_KINDS.map((kind) => {
        const id = actorId(`actor-${kind}-${status}`);
        return [id, participant(id, kind, status)] as const;
      }),
    ),
  );

  const owner = actorRef(actorId("actor-agent-active"), "agent");

  const artifacts = new Map(
    ARTIFACT_LIFECYCLES.map((lifecycle) => {
      const id = artifactId(`artifact-${lifecycle}`);
      return [id, workArtifact(id, "task", REF, owner, lifecycle)] as const;
    }),
  );

  const links = new Map(
    LINK_KINDS.map((kind) => {
      const id = linkId(`link-${kind}`);
      return [
        id,
        collaborationLink(
          id,
          kind,
          { kind: "participant", actorId: owner.actorId },
          { kind: "artifact", artifactId: artifactId("artifact-active") },
        ),
      ] as const;
    }),
  );

  const sessions = new Map(
    SESSION_VISIBILITIES.map((visibility) => {
      const id = sessionId(`session-${visibility}`);
      return [id, communicationSession(id, owner.actorId, [owner.actorId], visibility)] as const;
    }),
  );

  const capabilities = new Map(
    CAPABILITY_KINDS.map((kind) => {
      const id = capabilityId(`capability-${kind}`);
      return [
        id,
        scopedCapability(id, kind, owner.actorId, {
          kind: "artifact",
          artifactId: artifactId("artifact-active"),
        }),
      ] as const;
    }),
  );

  return collaborationSnapshot({
    snapshotRef: snapshotRef("snap-saturated"),
    epochId: epochId("e-1"),
    participants,
    artifacts,
    links,
    sessions,
    capabilities,
    // Observation sources are actor refs, so every actor kind must be legal here too.
    auditTail: ACTOR_KINDS.map((kind, index) =>
      observationEntry(index + 1, actorRef(actorId(`actor-${kind}-active`), kind), REF, AT),
    ),
    retiredEntities: RETIRED_ENTITY_KINDS.map((kind) =>
      entityTombstone(`entity-${kind}`, kind, AT),
    ),
    heartbeatLog: [
      {
        agentId: owner.actorId,
        sequenceNo: 1,
        emittedAt: AT,
        turnCount: 2,
        lastAction: "introduce_artifact",
      },
    ],
  });
}

describe("every enumerated value survives the durable round-trip", () => {
  it("re-reads a snapshot saturated with all enum members", () => {
    const before = saturatedSnapshot();
    // Through JSON, because that is what the file bundle actually stores.
    const parsed = parseSnapshotWire(JSON.parse(JSON.stringify(encodeSnapshot(before))));

    expect(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.violation)).toBe(true);
    if (!parsed.ok) return;
    expect(snapshotsCanonicallyEqual(decodeSnapshot(parsed.value), before)).toBe(true);
  });

  it("accepts each participation status on its own", () => {
    for (const status of PARTICIPATION_STATUSES) {
      const id = actorId("solo");
      const snapshot = collaborationSnapshot({
        snapshotRef: snapshotRef("snap-solo"),
        epochId: epochId("e-1"),
        participants: new Map([[id, participant(id, "agent", status)]]),
      });
      const parsed = parseSnapshotWire(JSON.parse(JSON.stringify(encodeSnapshot(snapshot))));
      expect(parsed.ok, `status ${status} must round-trip`).toBe(true);
    }
  });

  it("accepts each actor kind on its own", () => {
    for (const kind of ACTOR_KINDS) {
      const id = actorId("solo");
      const snapshot = collaborationSnapshot({
        snapshotRef: snapshotRef("snap-solo"),
        epochId: epochId("e-1"),
        participants: new Map([[id, participant(id, kind)]]),
        auditTail: [observationEntry(1, actorRef(id, kind), REF, AT)],
      });
      const parsed = parseSnapshotWire(JSON.parse(JSON.stringify(encodeSnapshot(snapshot))));
      expect(parsed.ok, `actor kind ${kind} must round-trip`).toBe(true);
    }
  });

  it("still rejects a value outside the enum", () => {
    const stored: Record<string, unknown> = JSON.parse(
      JSON.stringify(encodeSnapshot(saturatedSnapshot())),
    );
    const parsed = parseSnapshotWire({
      ...stored,
      participants: [{ actorId: "x", kind: "agent", status: "haunted" }],
    });
    expect(parsed.ok).toBe(false);
  });
});
