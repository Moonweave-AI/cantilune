import { describe, expect, it } from "vitest";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import { allForkBranches } from "../../support/scenario/largeComposition.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("large isolation matrix", () => {
  it.each([SCALE.small, SCALE.medium] as const)(
    "keeps all %i fork branches pairwise disjoint",
    (branchCount) => {
      const branches = allForkBranches(branchCount);
      for (let i = 0; i < branches.length; i++) {
        for (let j = i + 1; j < branches.length; j++) {
          const left = branches[i];
          const right = branches[j];
          if (left === undefined || right === undefined) {
            continue;
          }
          expect(compatibleConcurrently(left, right)).toBe(true);
        }
      }
    },
  );
});
