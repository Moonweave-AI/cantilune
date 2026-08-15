import { describe, expect, it } from "vitest";
import { testCoordinationChange } from "../../support/fixtures/change-fixture.js";
import {
  validateBeforeRefChain,
  validateEpochConsistent,
} from "../../../src/coordination/validation.js";
import { actorId, changeId, epochId, operationTypeId } from "../../../src/primitives/ids.js";
import { snapshotRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";

function introduceChange(
  id: string,
  before: string,
  after: string,
  epoch: string,
): ReturnType<typeof testCoordinationChange> {
  return testCoordinationChange({
    changeId: changeId(id),
    recordedAt: timestamp("2026-08-07T10:05:00Z"),
    epochId: epochId(epoch),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapshotRef(before),
    afterRef: snapshotRef(after),
    targets: [targetRef("artifact", "task-T")],
    initiator: actorRef(actorId("planner-p"), "agent"),
  });
}

describe("N5 replay chain violations", () => {
  it("rejects a broken beforeRef chain", () => {
    const first = introduceChange("chg-001", "snap-S0", "snap-S1", "42");
    const broken = introduceChange("chg-002", "snap-WRONG", "snap-S2", "42");

    expect(() => validateBeforeRefChain([first, broken])).toThrow(/beforeRef chain broken/);
  });
});

describe("N6 epoch consistency violations", () => {
  it("rejects mixed epochId within one chain", () => {
    const inEpoch42 = introduceChange("chg-001", "snap-S0", "snap-S1", "42");
    const inEpoch99 = introduceChange("chg-002", "snap-S1", "snap-S2", "99");

    expect(() => validateEpochConsistent([inEpoch42, inEpoch99])).toThrow(/epoch mismatch/);
  });
});
