import { describe, expect, it } from "vitest";
import {
  collaborationLink,
  collaborationSnapshot,
  communicationSession,
  coordinationChange,
  scopedCapability,
  changeId,
  epochId,
  linkId,
  operationTypeId,
  sessionId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
  capabilityId,
  artifactId,
} from "@cantilune/core";
import {
  cloneSnapshotForObservation,
  freezeFourViewBundle,
  sortById,
  sortLinksById,
} from "../../../src/foundation/immutableBoundary.js";
import { fourViewBundle } from "../../../src/index/fourViewBundle.js";
import { buildEventSpine } from "../../../src/world/eventSpine.js";
import { createEventTagIndex } from "../../../src/foundation/eventTagIndex.js";
import { dependencyView } from "../../../src/projection/views/dependencyView.js";
import { resourceView } from "../../../src/projection/views/resourceView.js";
import { communicationView } from "../../../src/projection/views/communicationView.js";
import { structureView } from "../../../src/projection/views/structureView.js";
import {
  type CommunicationDelta,
  type DependencyDelta,
  type ResourceDelta,
  type StructureDelta,
} from "../../../src/spine/projectionSlice.js";

describe("immutableBoundary", () => {
  it("clones snapshot without aliasing mutable collections", () => {
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S1"),
      epochId: epochId("1"),
    });
    const cloned = cloneSnapshotForObservation(snap);
    expect(cloned.snapshotRef).toBe(snap.snapshotRef);
    expect(cloned.participants).not.toBe(snap.participants);
  });

  it("sorts links and items by id", () => {
    const links = [
      collaborationLink(
        linkId("link-b"),
        "waits_for",
        { kind: "participant", actorId: actorId("a") },
        { kind: "participant", actorId: actorId("b") },
      ),
      collaborationLink(
        linkId("link-a"),
        "waits_for",
        { kind: "participant", actorId: actorId("a") },
        { kind: "participant", actorId: actorId("b") },
      ),
    ];
    expect(sortLinksById(links).map((link) => link.linkId)).toEqual(["link-a", "link-b"]);
    expect(sortById([{ id: "z" }, { id: "a" }], "id").map((item) => item.id)).toEqual(["a", "z"]);
  });

  it("freezes bundle with diagnostic and evidence branches", () => {
    const emptyDep = createEventTagIndex<DependencyDelta>([]);
    const emptyRes = createEventTagIndex<ResourceDelta>([]);
    const emptyComm = createEventTagIndex<CommunicationDelta>([]);
    const emptyStruct = createEventTagIndex<StructureDelta>([]);
    const change = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("1"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [],
      initiator: actorRef(actorId("planner"), "agent"),
      visibility: "external",
    });
    const spine = buildEventSpine([change]);
    const link = collaborationLink(
      linkId("link-1"),
      "waits_for",
      { kind: "participant", actorId: actorId("a") },
      { kind: "participant", actorId: actorId("b") },
    );
    const capability = scopedCapability(capabilityId("cap-1"), "write_lock", actorId("a"), {
      kind: "artifact",
      artifactId: artifactId("task-T"),
    });
    const session = communicationSession(sessionId("session-s"), actorId("a"), [actorId("a")]);
    const bundle = fourViewBundle({
      spine,
      dependency: dependencyView({ links: [link], byEvent: emptyDep }),
      resource: resourceView({ capabilities: [capability], byEvent: emptyRes }),
      communication: communicationView({ sessions: [session], byEvent: emptyComm }),
      structure: structureView({
        composition: { kind: "box" },
        structuralLinks: [link],
        byEvent: emptyStruct,
      }),
      diagnostic: {
        stats: {
          changes: 1,
          participants: 1,
          artifacts: 0,
          links: 0,
          sessions: 0,
          capabilities: 0,
          observations: 0,
        },
        compositionHint: { kind: "box" },
      },
      evidence: {
        byEvent: createEventTagIndex([]),
        terminalFieldsMatchSnapshot: true,
      },
    });
    const frozen = freezeFourViewBundle(bundle);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.diagnostic).toBeDefined();
    expect(frozen.evidence?.terminalFieldsMatchSnapshot).toBe(true);
  });
});
