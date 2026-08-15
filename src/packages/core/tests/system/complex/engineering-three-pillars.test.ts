import { describe, expect, it } from "vitest";
import { runThreePillarClosure } from "../../support/scenario/engineeringHarness.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("engineering three-pillar closure", () => {
  it("closes nodes · coordination · structure · consistency at stress scale", () => {
    const closure = runThreePillarClosure(SCALE.stressAgents, SCALE.stressLoopRounds);

    expect(closure.validated.kind).toBe("validated");
    expect(closure.snapshot.participants.size).toBeGreaterThan(SCALE.stressAgents);
    expect(closure.stats.changes).toBeGreaterThan(SCALE.stressLoopRounds * 2);
    expect(closure.view.kind).toBe("serial");
    if (closure.view.kind === "serial") {
      expect(closure.view.parts.length).toBeGreaterThan(0);
    }
  });
});
