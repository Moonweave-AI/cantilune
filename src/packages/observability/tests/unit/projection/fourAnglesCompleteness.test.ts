import { describe, expect, it } from "vitest";
import {
  collaborationLink,
  collaborationSnapshot,
  communicationSession,
  coordinationChange,
  scopedCapability,
  withCapability,
  withLink,
  withSession,
  withSnapshotRef,
  actorId,
  capabilityId,
  changeId,
  epochId,
  linkId,
  operationTypeId,
  sessionId,
  snapshotRef,
  timestamp,
  actorRef,
  targetRef,
} from "@cantilune/core";
import { createEventTagIndex } from "../../../src/foundation/eventTagIndex.js";
import { eventTagFromChange } from "../../../src/foundation/eventTag.js";
import {
  communicationEventsAt,
  communicationView,
} from "../../../src/projection/views/communicationView.js";
import {
  dependencyEventsAt,
  dependencyView,
} from "../../../src/projection/views/dependencyView.js";
import { resourceEventsAt, resourceView } from "../../../src/projection/views/resourceView.js";
import { structureEventsAt, structureView } from "../../../src/projection/views/structureView.js";
import { interpretCommunicationDelta } from "../../../src/projection/lenses/communicationLens.js";
import { interpretDependencyDelta } from "../../../src/projection/lenses/dependencyLens.js";
import { interpretResourceDelta } from "../../../src/projection/lenses/resourceLens.js";
import { interpretStructureDelta } from "../../../src/projection/lenses/structureLens.js";

/** Synthetic four-angle closure without runtime — validates diagram 03D field completeness. */
describe("four projection angles field completeness", () => {
  const snapS0 = snapshotRef("snap-S0");
  const snapS1 = snapshotRef("snap-S1");
  const snapS2 = snapshotRef("snap-S2");
  const planner = actorId("planner-p");
  const coder = actorId("coder-c");

  it("materializes all four views with EventTag-indexed byEvent and AtEvent queries", () => {
    const before = collaborationSnapshot({ snapshotRef: snapS0, epochId: epochId("42") });
    let after = withLink(
      withSession(
        withCapability(
          collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") }),
          scopedCapability(capabilityId("cap-1"), "write_lock", planner, {
            kind: "artifact",
            artifactId: "task-T" as never,
          }),
        ),
        communicationSession(sessionId("session-s"), coder, [coder, planner]),
      ),
      collaborationLink(
        linkId("link-waits-1"),
        "waits_for",
        { kind: "participant", actorId: planner },
        { kind: "participant", actorId: coder },
      ),
    );
    after = withLink(
      after,
      collaborationLink(
        linkId("link-nest-1"),
        "nested_in",
        { kind: "participant", actorId: planner },
        { kind: "participant", actorId: coder },
      ),
    );
    after = withSnapshotRef(after, snapS2);

    const change = coordinationChange({
      changeId: changeId("chg-nest"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("create_session"),
      beforeRef: snapS0,
      afterRef: snapS2,
      matchBindings: [],
      initiator: actorRef(planner, "agent"),
      visibility: "external",
      createdSessionRefs: [sessionId("session-s")],
      targets: [targetRef("participant", planner), targetRef("participant", coder)],
    });
    const tag = eventTagFromChange(change);

    const dependencyDelta = interpretDependencyDelta(tag, before, after);
    const resourceDelta = interpretResourceDelta(tag, before, after);
    const communicationDelta = interpretCommunicationDelta(tag, before, after);
    const structureDelta = interpretStructureDelta(tag, before, after, change);

    const depView = dependencyView({
      links: dependencyDelta.addedLinks,
      byEvent: createEventTagIndex([{ tag, value: dependencyDelta }]),
    });
    const resView = resourceView({
      capabilities: [...after.capabilities.values()],
      byEvent: createEventTagIndex([{ tag, value: resourceDelta }]),
    });
    const commView = communicationView({
      sessions: [...after.sessions.values()],
      byEvent: createEventTagIndex([{ tag, value: communicationDelta }]),
    });
    const strView = structureView({
      composition: structureDelta.step,
      structuralLinks: structureDelta.structuralLinks,
      byEvent: createEventTagIndex([{ tag, value: structureDelta }]),
    });

    expect(depView.byEvent.get(tag)).toBeDefined();
    expect(depView.byEvent.getByChangeId(change.changeId)).toBeDefined();
    expect(dependencyEventsAt(depView)).toHaveLength(1);
    expect(resourceEventsAt(resView)[0]?.value.removedCapabilityIds).toEqual([]);
    expect(communicationEventsAt(commView)[0]?.value.openedSessions).toHaveLength(1);
    expect(structureEventsAt(strView)[0]?.value.step.kind).toBe("nest");
    expect(structureDelta.structuralLinks[0]?.kind).toBe("nested_in");
  });
});
