import { describe, expect, it } from "vitest";
import { runUltimateCoreClosure } from "../../support/scenario/ultimateHarness.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("ultimate core closure", () => {
  it("closes orchestration · trace · isolation · operators · derive at extreme scale", () => {
    const closure = runUltimateCoreClosure();

    expect(closure.agentCount).toBe(SCALE.extremeAgents);
    expect(closure.orchestrationChanges).toBe(SCALE.extremeLoopRounds * 2);
    expect(closure.stressTaskCount).toBe(SCALE.extremeTasks);
    expect(closure.serialSliceCount).toBe(SCALE.extremeTasks);
    expect(closure.isolationPairs).toBe((SCALE.extremeAgents * (SCALE.extremeAgents - 1)) / 2);
    expect(closure.operatorIntents).toBe(7 * 100);
    expect(closure.nestPairs).toBe(Math.floor(SCALE.extremeAgents / 2));
    expect(closure.snapshot.artifacts.size).toBe(SCALE.extremeLoopRounds);
    expect(closure.history.length).toBeGreaterThan(
      SCALE.extremeLoopRounds * 2 + SCALE.extremeTasks,
    );
  });
});
