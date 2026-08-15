import { describe, expect, it } from "vitest";
import {
  deriveDiagnosticSummary,
  deriveSnapshotStatsWithHistory,
} from "../../../src/structure/derive.js";
import { buildLargeWorld } from "../../support/scenario/largeWorld.js";
import { buildSerialRewriteHistory } from "../../support/scenario/largeHistory.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("large derive serial view", () => {
  it("builds a serial diagnostic chain for large rewrite history", () => {
    const taskCount = SCALE.stressTasks;
    const snapshot = buildLargeWorld(16);
    const history = buildSerialRewriteHistory(taskCount);
    const stats = deriveSnapshotStatsWithHistory(snapshot, history);

    expect(stats.changes).toBe(taskCount);
    const view = deriveDiagnosticSummary(snapshot, history);
    expect(view.kind).toBe("serial");
    if (view.kind === "serial") {
      expect(view.parts).toHaveLength(taskCount);
    }
  });
});
