import { describe, expect, it } from "vitest";
import {
  validateBeforeRefChain,
  validateEpochConsistent,
} from "../../../src/coordination/validation.js";
import { validateSnapshotIntegrity } from "../../../src/consistency/snapshotIntegrity.js";
import { deriveDiagnosticSummary } from "../../../src/structure/derive.js";
import { rewriteSegments } from "../../../src/structure/trace.js";
import {
  countAgents,
  finalHolderForTask,
  runIntroduceDelegateLoop,
} from "../../support/scenario/orchestrationHarness.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("loop introduce-delegate orchestration", () => {
  it.each([
    { rounds: SCALE.small, agents: 8 },
    { rounds: 20, agents: 12 },
  ] as const)("runs %i rounds across %i agents with closed invariants", ({ rounds, agents }) => {
    const result = runIntroduceDelegateLoop(rounds, agents);

    expect(countAgents(result.final)).toBe(agents + 1);
    expect(result.final.artifacts.size).toBe(rounds);
    expect(result.final.capabilities.size).toBe(rounds);
    expect(rewriteSegments(result.history)).toHaveLength(rounds * 2);

    validateSnapshotIntegrity(result.final);
    validateBeforeRefChain(result.changes);
    validateEpochConsistent(result.changes);

    for (let round = 0; round < rounds; round++) {
      const expectedHolder = `agent-${round % agents}`;
      expect(finalHolderForTask(result.final, round)).toBe(expectedHolder);
    }

    const view = deriveDiagnosticSummary(result.final, result.history);
    expect(view.kind).toBe("serial");
    if (view.kind === "serial") {
      expect(view.parts).toHaveLength(rounds * 2);
    }
  });
});
