import { describe, expect, it } from "vitest";
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
  workArtifact,
  withArtifact,
  withSnapshotRef,
  artifactId,
  contentRef,
} from "@cantilune/core";
import {
  assertSnapshotsAvailable,
  deriveAllEventSlices,
  deriveEventSlice,
} from "../../../src/spine/deriveEventSlice.js";
import { foldFourViews, sliceHasProjectionActivity } from "../../../src/spine/foldFourViews.js";
import { observationWorld } from "../../../src/world/observationWorld.js";
import { sourceEventFromChange } from "../../../src/world/eventSpine.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";
import { readOnlyViolation } from "../../../src/foundation/readOnlyViolation.js";
import { expectReadOnlyViolation } from "../../support/assertions/violations.js";

describe("deriveEventSlice", () => {
  const snapS0 = snapshotRef("snap-S0");
  const snapS1 = snapshotRef("snap-S1");
  const planner = actorId("planner-p");
  const task = artifactId("task-T");

  it("throws snapshot_unavailable when before snapshot cannot be resolved", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    const after = withSnapshotRef(
      withArtifact(
        before,
        workArtifact(task, "Task", contentRef("content://task"), actorRef(planner, "agent")),
      ),
      snapS1,
    );
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
    const world = observationWorld({
      snapshotRef: snapS1,
      snapshot: after,
      validatedHistory: toValidatedHistory(),
      changes: [change],
      sinceRef: snapS0,
    });
    const event = sourceEventFromChange(change);
    expect(
      expectReadOnlyViolation(
        () =>
          deriveEventSlice(world, event, {
            resolve: (ref) => (ref === snapS1 ? after : undefined),
          }),
        "snapshot_unavailable",
      ).code,
    ).toBe("snapshot_unavailable");
  });

  it("folds multi-event structure into serial composition", () => {
    const changes = [0, 1].map((index) =>
      coordinationChange({
        changeId: changeId(`chg-${index}`),
        recordedAt: timestamp(`2026-08-07T10:0${index}:00Z`),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef(`snap-S${index}`),
        afterRef: snapshotRef(`snap-S${index + 1}`),
        matchBindings: [],
        initiator: actorRef(planner, "agent"),
        visibility: "external",
        targets: [{ kind: "artifact", id: `task-${index}` }],
      }),
    );
    const head = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S2"),
      epochId: epochId("42"),
    });
    const world = observationWorld({
      snapshotRef: head.snapshotRef,
      snapshot: head,
      validatedHistory: toValidatedHistory(),
      changes,
      sinceRef: snapS0,
    });
    const resolver = {
      resolve: (ref: typeof snapS0) => {
        if (ref === snapS0) {
          return collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
        }
        if (ref === snapS1) {
          return collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") });
        }
        return head;
      },
    };
    const slices = changes.map((change) =>
      deriveEventSlice(world, sourceEventFromChange(change), resolver),
    );
    const views = foldFourViews(world, slices);
    expect(views.structure.composition.kind).toBe("serial");
    expect(sliceHasProjectionActivity(slices[0]!)).toBe(true);
  });

  it("deriveAllEventSlices maps every spine event", () => {
    const changes = [0, 1].map((index) =>
      coordinationChange({
        changeId: changeId(`chg-${index}`),
        recordedAt: timestamp(`2026-08-07T10:0${index}:00Z`),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef(`snap-S${index}`),
        afterRef: snapshotRef(`snap-S${index + 1}`),
        matchBindings: [],
        initiator: actorRef(planner, "agent"),
        visibility: "external",
      }),
    );
    const head = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S2"),
      epochId: epochId("42"),
    });
    const world = observationWorld({
      snapshotRef: head.snapshotRef,
      snapshot: head,
      validatedHistory: toValidatedHistory(),
      changes,
      sinceRef: snapS0,
    });
    const resolver = {
      resolve: (ref: typeof snapS0) => {
        if (ref === snapS0) {
          return collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
        }
        if (ref === snapS1) {
          return collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") });
        }
        return head;
      },
    };
    const events = changes.map((change) => sourceEventFromChange(change));
    const slices = deriveAllEventSlices(world, events, resolver);
    expect(slices).toHaveLength(2);
  });

  it("assertSnapshotsAvailable wraps snapshot_unavailable as chain incomplete", () => {
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
    const world = observationWorld({
      snapshotRef: snapS1,
      snapshot: collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") }),
      validatedHistory: toValidatedHistory(),
      changes: [change],
      sinceRef: snapS0,
    });
    const events = [sourceEventFromChange(change)];
    expect(
      expectReadOnlyViolation(
        () =>
          assertSnapshotsAvailable(world, events, {
            resolve: (ref) => (ref === snapS1 ? world.snapshot : undefined),
          }),
        "snapshot_unavailable",
      ).code,
    ).toBe("snapshot_unavailable");
  });

  it("assertSnapshotsAvailable rethrows non-snapshot_unavailable errors", () => {
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
    const world = observationWorld({
      snapshotRef: snapS1,
      snapshot: collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") }),
      validatedHistory: toValidatedHistory(),
      changes: [change],
      sinceRef: snapS0,
    });
    const resolver = {
      resolve: () => {
        throw readOnlyViolation("invalid_input", "other failure", "resolver");
      },
    };
    expect(
      expectReadOnlyViolation(
        () => assertSnapshotsAvailable(world, [sourceEventFromChange(change)], resolver),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });
});
