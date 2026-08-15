import { describe, expect, it } from "vitest";
import { sliceRunHistory, validateRunHistory } from "../../../src/structure/trace.js";
import { buildStressTrace, sliceFootprintForTask } from "../../support/scenario/largeHistory.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("stress history validation", () => {
  it("validates and slices 200-task mixed observation/rewrite trace", () => {
    const history = buildStressTrace(SCALE.stressTasks, 5);
    const validated = validateRunHistory(history);

    expect(validated.kind).toBe("validated");
    expect(validated.segments.length).toBeGreaterThan(SCALE.stressTasks);

    for (const index of [0, 42, 99, 199]) {
      const slice = sliceRunHistory(history, sliceFootprintForTask(index));
      expect(slice.length).toBeGreaterThanOrEqual(1);
      const rewrite = slice.find((segment) => segment.kind === "rewrite");
      expect(rewrite?.kind).toBe("rewrite");
      if (rewrite?.kind === "rewrite") {
        expect(rewrite.change.changeId).toBe(`chg-stress-${index}`);
      }
    }
  });
});
