import { describe, expect, it } from "vitest";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import {
  allForkBranches,
  nestPairIntent,
  nestPairLayer,
} from "../../support/scenario/largeComposition.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("nest-fork composition tree", () => {
  it("allows parallel fork leaves and disjoint nest pairs at scale", () => {
    const branchCount = SCALE.medium;
    const forks = allForkBranches(branchCount);
    const nests = nestPairLayer(branchCount / 2, branchCount);

    for (const fork of forks) {
      for (const nest of nests) {
        expect(compatibleConcurrently(fork, nest)).toBe(true);
      }
    }
  });

  it("rejects nest pairs that share a participant", () => {
    const left = nestPairIntent(0, 1);
    const right = nestPairIntent(1, 2);
    expect(compatibleConcurrently(left, right)).toBe(false);
  });
});
