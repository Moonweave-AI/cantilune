import { describe, expect, it } from "vitest";
import {
  changeId,
  epochId,
  operationTypeId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
  coordinationChange,
} from "@cantilune/core";
import { eventTagFromChange } from "../../../src/foundation/eventTag.js";
import { projectionSlice } from "../../../src/spine/projectionSlice.js";

describe("projectionSlice", () => {
  it("combines per-angle deltas under shared eventTag", () => {
    const change = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [],
      initiator: actorRef(actorId("planner"), "agent"),
      visibility: "external",
    });
    const eventTag = eventTagFromChange(change);
    const dependency = {
      eventTag,
      addedLinks: [],
      updatedLinks: [],
      removedLinkIds: [],
    };
    const resource = {
      eventTag,
      updatedCapabilities: [],
      removedCapabilityIds: [],
    };
    const communication = {
      eventTag,
      openedSessions: [],
      closedSessionIds: [],
      updatedSessions: [],
    };
    const structure = {
      eventTag,
      step: { kind: "box" as const },
      structuralLinks: [],
      updatedStructuralLinks: [],
      removedStructuralLinkIds: [],
    };
    const slice = projectionSlice({ dependency, resource, communication, structure });
    expect(slice.eventTag).toBe(eventTag);
    expect(slice.dependency).toBe(dependency);
    expect(slice.structure.step.kind).toBe("box");
  });
});
