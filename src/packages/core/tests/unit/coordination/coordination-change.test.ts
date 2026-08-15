import { describe, expect, it } from "vitest";
import {
  coordinationChange,
  coordinationIntent,
  proposedChange,
} from "../../../src/coordination/coordinationChange.js";
import {
  actorId,
  changeId,
  epochId,
  evidenceId,
  operationTypeId,
} from "../../../src/primitives/ids.js";
import {
  contentRef,
  evidenceRef,
  matchBinding,
  snapshotRef,
  targetRef,
} from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";

describe("coordinationChange", () => {
  it("carries no payload field by design", () => {
    const change = coordinationChange({
      changeId: changeId("chg-002"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-S1"),
      afterRef: snapshotRef("snap-S2"),
      matchBindings: [matchBinding("artifact", "task-T"), matchBinding("participant", "coder-c")],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });

    expect(change.operationTypeId).toBe("delegate");
    expect("payload" in change).toBe(false);
    expect(change.matchBindings).toHaveLength(2);
  });

  it("builds intents and proposed changes before commit", () => {
    const intent = coordinationIntent(
      actorRef(actorId("planner-p"), "agent"),
      operationTypeId("delegate"),
      [matchBinding("task", "task-T")],
    );
    const proposed = proposedChange(intent, snapshotRef("snap-S1"));
    expect(proposed.beforeRef).toBe("snap-S1");
    expect(proposed.intent.operationTypeId).toBe("delegate");
    expect(proposed.intent.targets).toEqual([targetRef("artifact", "task-T")]);
  });

  it("keeps operation content inputs separate from external evidence", () => {
    const bodyRef = contentRef(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const proofRef = contentRef(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    const external = [evidenceRef(evidenceId("ev-1"), "observation", proofRef)];

    const intent = coordinationIntent(
      actorRef(actorId("planner-p"), "agent"),
      operationTypeId("introduce_artifact"),
      [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      external,
      [bodyRef],
      { turnCount: 7, lastAction: "write_content" },
    );

    expect(intent.inputContentRefs).toEqual([bodyRef]);
    expect(intent.external).toEqual(external);
    expect(intent.scalarInputs).toEqual({ turnCount: 7, lastAction: "write_content" });
    expect(intent.inputContentRefs).not.toEqual(intent.external?.map((item) => item.contentRef));
  });
});
