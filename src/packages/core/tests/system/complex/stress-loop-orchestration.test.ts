import { describe, expect, it } from "vitest";
import { validateSnapshotIntegrity } from "../../../src/consistency/snapshotIntegrity.js";
import {
  validateBeforeRefChain,
  validateEpochConsistent,
} from "../../../src/coordination/validation.js";
import { deriveDiagnosticSummary } from "../../../src/structure/derive.js";
import { rewriteSegments } from "../../../src/structure/trace.js";
import {
  countAgents,
  finalHolderForTask,
  runIntroduceDelegateLoop,
} from "../../support/scenario/orchestrationHarness.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("stress loop orchestration", () => {
  it("runs 50 introduce-delegate rounds across 100 agents", () => {
    const result = runIntroduceDelegateLoop(SCALE.stressLoopRounds, SCALE.stressAgents);

    expect(countAgents(result.final)).toBe(SCALE.stressAgents + 1);
    expect(result.final.artifacts.size).toBe(SCALE.stressLoopRounds);
    expect(rewriteSegments(result.history)).toHaveLength(SCALE.stressLoopRounds * 2);

    validateSnapshotIntegrity(result.final);
    validateBeforeRefChain(result.changes);
    validateEpochConsistent(result.changes);

    for (let round = 0; round < SCALE.stressLoopRounds; round++) {
      const expected = `agent-${round % SCALE.stressAgents}`;
      expect(finalHolderForTask(result.final, round)).toBe(expected);
    }

    const view = deriveDiagnosticSummary(result.final, result.history);
    expect(view.kind).toBe("serial");
    if (view.kind === "serial") {
      expect(view.parts).toHaveLength(SCALE.stressLoopRounds * 2);
    }
  });
});
