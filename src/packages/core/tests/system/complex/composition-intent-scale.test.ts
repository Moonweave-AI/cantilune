import { describe, expect, it } from "vitest";
import { toCoordinationIntent } from "../../../src/structure/operators.js";
import { allForkBranches, delegateStepIntent } from "../../support/scenario/largeComposition.js";
import { SCALE } from "../../support/scenario/largeWorld.js";

describe("composition to coordination intent at scale", () => {
  it("maps fork branches and delegate steps without losing targets", () => {
    const branches = allForkBranches(SCALE.medium);
    for (const branch of branches) {
      const intent = toCoordinationIntent(branch);
      expect(intent.matchBindings.length).toBeGreaterThan(0);
      expect(intent.targets).toHaveLength(intent.matchBindings.length);
    }

    const delegateSteps = Array.from({ length: SCALE.small - 1 }, (_, index) =>
      delegateStepIntent(index),
    );
    for (const step of delegateSteps) {
      const intent = toCoordinationIntent(step);
      expect(intent.operationTypeId).toBe("delegate");
      expect(intent.targets.some((target) => target.kind === "artifact")).toBe(true);
    }
  });
});
