import { describe, expect, it } from "vitest";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import { allForkBranches } from "../../support/scenario/largeComposition.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("stress isolation matrix", () => {
  it("keeps 100 fork branches pairwise disjoint", () => {
    const branches = allForkBranches(SCALE.stressAgents);
    expect(branches).toHaveLength(SCALE.stressAgents);

    let pairs = 0;
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const left = branches[i];
        const right = branches[j];
        if (left === undefined || right === undefined) {
          continue;
        }
        expect(compatibleConcurrently(left, right)).toBe(true);
        pairs += 1;
      }
    }
    expect(pairs).toBe((SCALE.stressAgents * (SCALE.stressAgents - 1)) / 2);
  });

  it("keeps 200 fork branches pairwise disjoint at extreme scale", () => {
    const branches = allForkBranches(SCALE.extremeAgents);
    expect(branches).toHaveLength(SCALE.extremeAgents);

    let pairs = 0;
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const left = branches[i];
        const right = branches[j];
        if (left === undefined || right === undefined) {
          continue;
        }
        expect(compatibleConcurrently(left, right)).toBe(true);
        pairs += 1;
      }
    }
    expect(pairs).toBe((SCALE.extremeAgents * (SCALE.extremeAgents - 1)) / 2);
  });
});
