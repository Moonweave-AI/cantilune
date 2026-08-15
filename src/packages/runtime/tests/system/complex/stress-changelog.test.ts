import { describe, expect, it } from "vitest";
import {
  changeId,
  coordinationChange,
  epochId,
  matchBinding,
  operationTypeId,
  snapshotRef,
} from "@cantilune/core";
import { actorRef, actorId } from "@cantilune/core";
import { timestamp } from "@cantilune/core";
import { MemoryChangeLog } from "../../../src/memory/memoryChangeLog.js";
import { RUNTIME_SCALE } from "../../support/scenario/largeWorld.js";

function syntheticChange(index: number) {
  return coordinationChange({
    changeId: changeId(`chg-log-${index}`),
    recordedAt: timestamp(`2026-08-07T10:${String(index % 60).padStart(2, "0")}:00Z`),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapshotRef(`snap-S${index}`),
    afterRef: snapshotRef(`snap-S${index + 1}`),
    matchBindings: [matchBinding("task", `task-${index}`)],
    initiator: actorRef(actorId("planner-p"), "agent"),
    visibility: "internal",
  });
}

describe("stress memory changelog", () => {
  it("stores and slices 200-change chains via since()", () => {
    const log = new MemoryChangeLog();
    const total = RUNTIME_SCALE.stressCodecBatch * 2;

    for (let index = 0; index < total; index++) {
      expect(log.append(syntheticChange(index))).toBe(true);
    }

    expect(log.all()).toHaveLength(total);
    const mid = Math.floor(total / 2);
    const slice = log.since(snapshotRef(`snap-S${mid}`));
    expect(slice).toHaveLength(total - mid);
    expect(slice[0]?.beforeRef).toBe(snapshotRef(`snap-S${mid}`));
    expect(log.get(changeId(`chg-log-${total - 1}`))?.changeId).toBe(`chg-log-${total - 1}`);
  });
});
