import { describe, expect, it } from "vitest";
import { collaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import {
  validateAuditTailMatchesHistory,
  validateBeforeRefChain,
  validateEpochConsistent,
} from "../../../src/coordination/validation.js";
import { coordinationChange } from "../../../src/coordination/coordinationChange.js";
import {
  actorId,
  changeId,
  epochId,
  operationTypeId,
} from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import {
  appendObservationSegment,
  emptyRunHistory,
} from "../../../src/structure/trace.js";

describe("validateAuditTailMatchesHistory", () => {
  it("accepts matching snapshot and history observations", () => {
    const entry = {
      sequenceNo: 1,
      source: actorRef(actorId("human-1"), "human"),
      payloadRef: contentRef("content://obs-1"),
      receivedAt: timestamp("2026-08-07T10:00:00Z"),
    };
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      auditTail: [entry],
    });
    const history = appendObservationSegment(emptyRunHistory(), entry);

    expect(() => validateAuditTailMatchesHistory(snapshot, history)).not.toThrow();
  });
});

describe("validateBeforeRefChain", () => {
  it("accepts a continuous chain", () => {
    const changes = [
      coordinationChange({
        changeId: changeId("chg-001"),
        recordedAt: timestamp("2026-08-07T10:05:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("introduce_artifact"),
        beforeRef: snapshotRef("snap-S0"),
        afterRef: snapshotRef("snap-S1"),
        targets: [targetRef("artifact", "task-T")],
        initiator: actorRef(actorId("planner-p"), "agent"),
      }),
      coordinationChange({
        changeId: changeId("chg-002"),
        recordedAt: timestamp("2026-08-07T10:10:00Z"),
        epochId: epochId("42"),
        operationTypeId: operationTypeId("delegate"),
        beforeRef: snapshotRef("snap-S1"),
        afterRef: snapshotRef("snap-S2"),
        targets: [targetRef("artifact", "task-T")],
        initiator: actorRef(actorId("planner-p"), "agent"),
      }),
    ];

    expect(() => validateBeforeRefChain(changes)).not.toThrow();
    expect(() => validateEpochConsistent(changes)).not.toThrow();
  });
});
