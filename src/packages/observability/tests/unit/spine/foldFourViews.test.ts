import { describe, expect, it } from "vitest";
import {
  collaborationSnapshot,
  epochId,
  snapshotRef,
  actorId,
  participant,
  changeId,
  coordinationChange,
  operationTypeId,
  timestamp,
  actorRef,
} from "@cantilune/core";
import {
  compositionFromSnapshot,
  foldStructureComposition,
} from "../../../src/projection/lenses/structureLens.js";
import { foldFourViews, sliceHasProjectionActivity } from "../../../src/spine/foldFourViews.js";
import { observationWorld } from "../../../src/world/observationWorld.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";
import { eventTagFromChange } from "../../../src/foundation/eventTag.js";

describe("structureLens composition helpers", () => {
  it("compositionFromSnapshot handles empty, single, and multi participant snapshots", () => {
    expect(
      compositionFromSnapshot(
        collaborationSnapshot({ snapshotRef: snapshotRef("snap-S0"), epochId: epochId("1") }),
      ).kind,
    ).toBe("box");
    const one = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S1"),
      epochId: epochId("1"),
      participants: new Map([[actorId("a"), participant(actorId("a"), "agent")]]),
    });
    const oneBox = compositionFromSnapshot(one);
    expect(oneBox.kind).toBe("box");
    if (oneBox.kind === "box") {
      expect(oneBox.participantId).toBe(actorId("a"));
    }
    const two = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S2"),
      epochId: epochId("1"),
      participants: new Map([
        [actorId("a"), participant(actorId("a"), "agent")],
        [actorId("b"), participant(actorId("b"), "agent")],
      ]),
    });
    expect(compositionFromSnapshot(two).kind).toBe("parallel");
  });

  it("foldStructureComposition picks snapshot composition when no steps", () => {
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("1"),
    });
    expect(foldStructureComposition([], snapshot).kind).toBe("box");
    expect(foldStructureComposition([{ kind: "box" }], snapshot).kind).toBe("box");
    expect(
      foldStructureComposition(
        [{ kind: "box" }, { kind: "nest", inner: { kind: "box" }, label: "test" }],
        snapshot,
      ).kind,
    ).toBe("serial");
  });
});

describe("foldFourViews visibility and sliceHasProjectionActivity", () => {
  it("filters administrative changes from read angles", () => {
    const snapS0 = snapshotRef("snap-S0");
    const snapS1 = snapshotRef("snap-S1");
    const change = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapS0,
      afterRef: snapS1,
      matchBindings: [],
      initiator: actorRef(actorId("planner"), "agent"),
      visibility: "administrative",
    });
    const world = observationWorld({
      snapshotRef: snapS1,
      snapshot: collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") }),
      validatedHistory: toValidatedHistory(),
      changes: [change],
      sinceRef: snapS0,
    });
    const eventTag = eventTagFromChange(change);
    const emptySlice = {
      eventTag,
      dependency: { eventTag, addedLinks: [], updatedLinks: [], removedLinkIds: [] },
      resource: { eventTag, updatedCapabilities: [], removedCapabilityIds: [] },
      communication: { eventTag, openedSessions: [], closedSessionIds: [], updatedSessions: [] },
      structure: {
        eventTag,
        step: { kind: "box" as const },
        structuralLinks: [],
        updatedStructuralLinks: [],
        removedStructuralLinkIds: [],
      },
    };
    const views = foldFourViews(world, [emptySlice]);
    expect(views.dependency.byEvent.size).toBe(0);
  });

  it("sliceHasProjectionActivity treats populated box steps as active", () => {
    const eventTag = eventTagFromChange(
      coordinationChange({
        changeId: changeId("chg-001"),
        recordedAt: timestamp("2026-08-07T10:00:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef("snap-S0"),
        afterRef: snapshotRef("snap-S1"),
        matchBindings: [],
        initiator: actorRef(actorId("planner"), "agent"),
        visibility: "external",
      }),
    );
    expect(
      sliceHasProjectionActivity({
        eventTag,
        dependency: { eventTag, addedLinks: [], updatedLinks: [], removedLinkIds: [] },
        resource: { eventTag, updatedCapabilities: [], removedCapabilityIds: [] },
        communication: { eventTag, openedSessions: [], closedSessionIds: [], updatedSessions: [] },
        structure: {
          eventTag,
          step: { kind: "box", participantId: actorId("planner") },
          structuralLinks: [],
          updatedStructuralLinks: [],
          removedStructuralLinkIds: [],
        },
      }),
    ).toBe(true);
    expect(
      sliceHasProjectionActivity({
        eventTag,
        dependency: { eventTag, addedLinks: [], updatedLinks: [], removedLinkIds: [] },
        resource: { eventTag, updatedCapabilities: [], removedCapabilityIds: [] },
        communication: { eventTag, openedSessions: [], closedSessionIds: [], updatedSessions: [] },
        structure: {
          eventTag,
          step: { kind: "box" },
          structuralLinks: [],
          updatedStructuralLinks: [],
          removedStructuralLinkIds: [],
        },
      }),
    ).toBe(false);
  });
});
