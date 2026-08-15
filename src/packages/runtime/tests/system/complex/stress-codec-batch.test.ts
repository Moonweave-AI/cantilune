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
import { decodeChange, encodeChange } from "../../../src/codec/changeCodec.js";
import { RUNTIME_SCALE } from "../../support/scenario/largeWorld.js";

describe("stress change codec batch", () => {
  it("round-trips 100 coordination changes without payload leakage", () => {
    for (let index = 0; index < RUNTIME_SCALE.stressCodecBatch; index++) {
      const original = coordinationChange({
        changeId: changeId(`chg-batch-${index}`),
        recordedAt: timestamp(`2026-08-07T10:${String(index % 60).padStart(2, "0")}:00Z`),
        epochId: epochId("42"),
        operationTypeId: operationTypeId(index % 2 === 0 ? "introduce_artifact" : "delegate"),
        beforeRef: snapshotRef(`snap-S${index}`),
        afterRef: snapshotRef(`snap-S${index + 1}`),
        matchBindings: [
          matchBinding("task", `task-${index}`),
          matchBinding("from", `agent-${index % 20}`),
        ],
        initiator: actorRef(actorId(`agent-${index % 20}`), "agent"),
        visibility: "external",
      });

      const decoded = decodeChange(encodeChange(original));
      expect(decoded.changeId).toBe(original.changeId);
      expect(decoded.beforeRef).toBe(original.beforeRef);
      expect(decoded.afterRef).toBe(original.afterRef);
      expect("payload" in decoded).toBe(false);
    }
  });
});
