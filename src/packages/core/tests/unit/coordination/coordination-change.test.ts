import { describe, expect, it } from "vitest";
import { coordinationChange, coordinationIntent, proposedChange } from "../../../src/coordination/coordinationChange.js";
import { actorId, changeId, epochId, operationTypeId } from "../../../src/primitives/ids.js";
import { snapshotRef, targetRef } from "../../../src/primitives/refs.js";
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
      targets: [
        targetRef("artifact", "task-T"),
        targetRef("participant", "coder-c"),
      ],
      initiator: actorRef(actorId("planner-p"), "agent"),
    });

    expect(change.operationTypeId).toBe("delegate");
    expect("payload" in change).toBe(false);
  });

  it("builds intents and proposed changes before commit", () => {
    const intent = coordinationIntent(
      actorRef(actorId("planner-p"), "agent"),
      operationTypeId("delegate"),
      [targetRef("artifact", "task-T")],
    );
    const proposed = proposedChange(intent, snapshotRef("snap-S1"));
    expect(proposed.beforeRef).toBe("snap-S1");
    expect(proposed.intent.operationTypeId).toBe("delegate");
  });
});
