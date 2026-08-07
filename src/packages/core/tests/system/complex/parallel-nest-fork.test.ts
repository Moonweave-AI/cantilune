import { describe, expect, it } from "vitest";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import {
  buildForkIntentCDE,
  buildNestIntentAB,
} from "../../support/fixtures/composition/parallel-nest-fork.js";

describe("parallel nest and fork", () => {
  it("allows concurrent composition when footprints are disjoint", () => {
    expect(compatibleConcurrently(buildNestIntentAB(), buildForkIntentCDE())).toBe(true);
  });
});
