import { describe, expect, it } from "vitest";
import {
  changeId,
  coordinationChange,
  epochId,
  operationTypeId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
} from "@cantilune/core";
import { eventTagFromChange, eventTagKey } from "../../../src/foundation/eventTag.js";
import { atEvent } from "../../../src/foundation/atEvent.js";
import {
  isReadOnlyViolation,
  readOnlyViolation,
} from "../../../src/foundation/readOnlyViolation.js";

describe("eventTag", () => {
  it("derives stable join keys from coordination changes", () => {
    const change = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });
    const tag = eventTagFromChange(change);
    expect(eventTagKey(tag)).toContain("chg-001");
    expect(atEvent(tag, change).value.changeId).toBe("chg-001");
  });
});

describe("readOnlyViolation", () => {
  it("identifies observability-side failures without mutating core/runtime", () => {
    const violation = readOnlyViolation("invalid_input", "head missing", "headRef");
    expect(isReadOnlyViolation(violation)).toBe(true);
    expect(violation.path).toBe("headRef");
  });
});
