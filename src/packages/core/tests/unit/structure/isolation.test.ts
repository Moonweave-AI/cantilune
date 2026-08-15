import { describe, expect, it } from "vitest";
import { matchBindingsFromTargets } from "../../../src/primitives/refs.js";
import { testCoordinationChange } from "../../support/fixtures/change-fixture.js";
import {
  actorId,
  artifactId,
  capabilityId,
  changeId,
  epochId,
  linkId,
  operationTypeId,
  sessionId,
} from "../../../src/primitives/ids.js";
import { snapshotRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import {
  compatibleConcurrently,
  disjoint,
  footprintFromTargets,
  footprintOfChange,
  footprintOfCompositionIntent,
  footprintOfCoordinationIntent,
  overlaps,
} from "../../../src/structure/isolation.js";
import { compositionIntent } from "../../../src/structure/operators.js";
import { footprint } from "../../../src/structure/boundary.js";

describe("disjoint", () => {
  it("returns true when footprints share no ids", () => {
    const a = footprint({
      participantIds: [actorId("A")],
      artifactIds: [artifactId("task-1")],
    });
    const b = footprint({
      participantIds: [actorId("C"), actorId("D")],
      artifactIds: [artifactId("task-2")],
    });
    expect(disjoint(a, b)).toBe(true);
  });

  it("returns false when capability is shared", () => {
    const cap = capabilityId("write-lock-w");
    const a = footprint({ capabilityIds: [cap] });
    const b = footprint({ capabilityIds: [cap] });
    expect(disjoint(a, b)).toBe(false);
  });

  it("reports overlap as the inverse of disjoint", () => {
    const a = footprint({ participantIds: [actorId("A")] });
    const b = footprint({ participantIds: [actorId("A")] });
    expect(overlaps(a, b)).toBe(true);
    expect(disjoint(a, b)).toBe(false);
  });
});

describe("footprintFromTargets", () => {
  it("collects all target kinds", () => {
    const fp = footprintFromTargets([
      targetRef("artifact", "task-T"),
      targetRef("participant", "coder-c"),
      targetRef("session", "session-s"),
      targetRef("capability", "write-lock-w"),
      targetRef("link", "link-1"),
    ]);
    expect(fp.artifactIds.has(artifactId("task-T"))).toBe(true);
    expect(fp.participantIds.has(actorId("coder-c"))).toBe(true);
    expect(fp.sessionIds.has(sessionId("session-s"))).toBe(true);
    expect(fp.capabilityIds.has(capabilityId("write-lock-w"))).toBe(true);
    expect(fp.linkIds.has(linkId("link-1"))).toBe(true);
  });
});

describe("footprintOfChange", () => {
  it("merges created session refs into the footprint", () => {
    const change = testCoordinationChange({
      changeId: changeId("chg-delegate"),
      recordedAt: timestamp("2026-08-07T11:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      targets: [targetRef("artifact", "task-T")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      createdSessionRefs: [sessionId("session-s")],
    });
    const fp = footprintOfChange(change);
    expect(fp.sessionIds.has(sessionId("session-s"))).toBe(true);
  });
});

describe("footprint of intents", () => {
  it("derives coordination intent footprint from targets", () => {
    const intent = compositionIntent(
      "delegate",
      actorRef(actorId("planner-p"), "agent"),
      footprint({ artifactIds: [artifactId("task-T")] }),
      [targetRef("artifact", "task-T")],
    );
    const coordination = footprintOfCoordinationIntent({
      initiator: intent.initiator,
      operationTypeId: operationTypeId("delegate"),
      matchBindings: matchBindingsFromTargets(intent.targets),
      targets: intent.targets,
    });
    expect(coordination.artifactIds.has(artifactId("task-T"))).toBe(true);
    expect(footprintOfCompositionIntent(intent).artifactIds.has(artifactId("task-T"))).toBe(true);
  });

  it("detects incompatible concurrent composition intents", () => {
    const cap = capabilityId("write-lock-w");
    const left = compositionIntent(
      "delegate",
      actorRef(actorId("planner-p"), "agent"),
      footprint({ capabilityIds: [cap] }),
      [targetRef("capability", "write-lock-w")],
    );
    const right = compositionIntent(
      "delegate",
      actorRef(actorId("coder-c"), "agent"),
      footprint({ capabilityIds: [cap] }),
      [targetRef("capability", "write-lock-w")],
    );
    expect(compatibleConcurrently(left, right)).toBe(false);
  });
});
