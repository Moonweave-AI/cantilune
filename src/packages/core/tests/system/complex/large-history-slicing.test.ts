import { describe, expect, it } from "vitest";
import { sliceRunHistory } from "../../../src/structure/trace.js";
import {
  buildSerialRewriteHistory,
  sliceFootprintForTask,
} from "../../support/scenario/largeHistory.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("large history slicing", () => {
  it.each([SCALE.small, SCALE.large, SCALE.stressTasks] as const)(
    "slices %i-task serial history to exactly one rewrite per scope",
    (taskCount) => {
      const history = buildSerialRewriteHistory(taskCount);

      for (let index = 0; index < taskCount; index++) {
        const slice = sliceRunHistory(history, sliceFootprintForTask(index));
        expect(slice).toHaveLength(1);
        const segment = slice[0];
        expect(segment?.kind).toBe("rewrite");
        if (segment?.kind === "rewrite") {
          expect(segment.change.changeId).toBe(`chg-task-${index}`);
        }
      }
    },
  );
});
