import { describe, expect, it } from "vitest";
import { buildReadModelDerivationEvidence } from "../../../src/certificate/readModelDerivationEvidence.js";
import { fourViewBundle } from "../../../src/index/fourViewBundle.js";
import { createEventTagIndex } from "../../../src/foundation/eventTagIndex.js";
import { eventTagFromChange } from "../../../src/foundation/eventTag.js";
import {
  collaborationSnapshot,
  coordinationChange,
  epochId,
  changeId,
  operationTypeId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
  collaborationLink,
  linkId,
  communicationSession,
  sessionId,
} from "@cantilune/core";
import { observationWorld } from "../../../src/world/observationWorld.js";
import { buildEventSpine } from "../../../src/world/eventSpine.js";
import { foldFourViews } from "../../../src/spine/foldFourViews.js";
import { deriveAllEventSlices } from "../../../src/spine/deriveEventSlice.js";
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
import { toValidatedHistory } from "../../support/toValidatedHistory.js";

describe("ReadModelDerivationEvidence", () => {
  it("attaches rederivedDeltaMatches evidence per eventTag", () => {
    const snapS0 = snapshotRef("snap-S0");
    const snapS1 = snapshotRef("snap-S1");
    const planner = actorId("planner-p");
    const change = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapS0,
      afterRef: snapS1,
      matchBindings: [],
      initiator: actorRef(planner, "agent"),
      visibility: "external",
      targets: [{ kind: "artifact", id: "task-T" }],
    });
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const after = collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") });
    const world = observationWorld({
      snapshotRef: snapS1,
      snapshot: after,
      validatedHistory: toValidatedHistory(),
      changes: [change],
      sinceRef: snapS0,
    });
    const spine = buildEventSpine([change]);
    const resolver = { resolve: (ref: typeof snapS0) => (ref === snapS0 ? before : after) };
    const slices = deriveAllEventSlices(world, spine.events, resolver);
    const views = foldFourViews(world, slices);
    const bundle = fourViewBundle({
      spine,
      dependency: views.dependency,
      resource: views.resource,
      communication: views.communication,
      structure: views.structure,
    });
    const evidence = buildReadModelDerivationEvidence(bundle, world, resolver);
    const tag = eventTagFromChange(change);
    const eventEvidence = evidence.byEvent.get(tag);
    expect(eventEvidence?.dependency.rederivedDeltaMatches).toBe(true);
    expect(eventEvidence?.resource.rederivedDeltaMatches).toBe(true);
    expect(eventEvidence?.communication.rederivedDeltaMatches).toBe(true);
    expect(eventEvidence?.structure.rederivedDeltaMatches).toBe(true);
    expect(evidence.terminalFieldsMatchSnapshot).toBe(true);
  });

  it("detects terminal snapshot drift when dependency links are omitted", () => {
    const snap = snapshotRef("snap-S1");
    const worldSnap = collaborationSnapshot({
      snapshotRef: snap,
      epochId: epochId("1"),
      links: new Map([
        [
          linkId("link-1"),
          collaborationLink(
            linkId("link-1"),
            "waits_for",
            { kind: "participant", actorId: actorId("a") },
            { kind: "participant", actorId: actorId("b") },
          ),
        ],
      ]),
    });
    const emptyDependencyIndex = createEventTagIndex<DependencyDelta>([]);
    const emptyResourceIndex = createEventTagIndex<ResourceDelta>([]);
    const emptyCommunicationIndex = createEventTagIndex<CommunicationDelta>([]);
    const emptyStructureIndex = createEventTagIndex<StructureDelta>([]);
    const bundle = fourViewBundle({
      spine: buildEventSpine([]),
      dependency: dependencyView({ links: [], byEvent: emptyDependencyIndex }),
      resource: resourceView({ capabilities: [], byEvent: emptyResourceIndex }),
      communication: communicationView({ sessions: [], byEvent: emptyCommunicationIndex }),
      structure: structureView({
        composition: { kind: "box" },
        structuralLinks: [],
        byEvent: emptyStructureIndex,
      }),
    });
    const world = observationWorld({
      snapshotRef: snap,
      snapshot: worldSnap,
      validatedHistory: toValidatedHistory(),
      changes: [],
      sinceRef: snap,
    });
    const evidence = buildReadModelDerivationEvidence(bundle, world, {
      resolve: () => worldSnap,
    });
    expect(evidence.terminalFieldsMatchSnapshot).toBe(false);
  });

  it("reports snapshots unresolved when resolver lacks before snapshot", () => {
    const snapS0 = snapshotRef("snap-S0");
    const snapS1 = snapshotRef("snap-S1");
    const planner = actorId("planner-p");
    const change = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapS0,
      afterRef: snapS1,
      matchBindings: [],
      initiator: actorRef(planner, "agent"),
      visibility: "external",
    });
    const after = collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") });
    const world = observationWorld({
      snapshotRef: snapS1,
      snapshot: after,
      validatedHistory: toValidatedHistory(),
      changes: [change],
      sinceRef: snapS0,
    });
    const spine = buildEventSpine([change]);
    const emptyDep = createEventTagIndex<DependencyDelta>([]);
    const emptyRes = createEventTagIndex<ResourceDelta>([]);
    const emptyComm = createEventTagIndex<CommunicationDelta>([]);
    const emptyStruct = createEventTagIndex<StructureDelta>([]);
    const bundle = fourViewBundle({
      spine,
      dependency: dependencyView({ links: [], byEvent: emptyDep }),
      resource: resourceView({ capabilities: [], byEvent: emptyRes }),
      communication: communicationView({ sessions: [], byEvent: emptyComm }),
      structure: structureView({
        composition: { kind: "box" },
        structuralLinks: [],
        byEvent: emptyStruct,
      }),
    });
    const evidence = buildReadModelDerivationEvidence(bundle, world, {
      resolve: (ref) => (ref === snapS1 ? after : undefined),
    });
    const tag = eventTagFromChange(change);
    const eventEvidence = evidence.byEvent.get(tag);
    expect(eventEvidence?.dependency.snapshotsResolved).toBe(false);
    expect(eventEvidence?.dependency.rederivedDeltaMatches).toBe(false);
  });

  it("detects session terminal drift in evidence", () => {
    const snap = snapshotRef("snap-S1");
    const session = communicationSession(sessionId("session-s"), actorId("a"), [actorId("a")]);
    const worldSnap = collaborationSnapshot({
      snapshotRef: snap,
      epochId: epochId("1"),
      sessions: new Map([[session.sessionId, session]]),
    });
    const emptyDep = createEventTagIndex<DependencyDelta>([]);
    const emptyRes = createEventTagIndex<ResourceDelta>([]);
    const emptyComm = createEventTagIndex<CommunicationDelta>([]);
    const emptyStruct = createEventTagIndex<StructureDelta>([]);
    const bundle = fourViewBundle({
      spine: buildEventSpine([]),
      dependency: dependencyView({ links: [], byEvent: emptyDep }),
      resource: resourceView({ capabilities: [], byEvent: emptyRes }),
      communication: communicationView({ sessions: [], byEvent: emptyComm }),
      structure: structureView({
        composition: { kind: "box" },
        structuralLinks: [],
        byEvent: emptyStruct,
      }),
    });
    const world = observationWorld({
      snapshotRef: snap,
      snapshot: worldSnap,
      validatedHistory: toValidatedHistory(),
      changes: [],
      sinceRef: snap,
    });
    const evidence = buildReadModelDerivationEvidence(bundle, world, {
      resolve: () => worldSnap,
    });
    expect(evidence.terminalFieldsMatchSnapshot).toBe(false);
  });
});
