import { describe, expect, it } from "vitest";
import { matchBinding } from "@cantilune/core";
import { matchWitnessFromBindings, verifyMatchWitness } from "../../../src/replay/matchWitness.js";
import { RUNTIME_SCALE } from "../../support/scenario/largeWorld.js";

describe("matchWitness at scale", () => {
  it("verifies witnesses for 100-binding recipes", () => {
    const bindings = Array.from({ length: RUNTIME_SCALE.stressCodecBatch }, (_, index) =>
      matchBinding(index % 2 === 0 ? "task" : "from", `id-${index}`),
    );
    const witness = matchWitnessFromBindings(bindings);
    expect(witness.domainSize).toBe(RUNTIME_SCALE.stressCodecBatch);
    expect(verifyMatchWitness(witness, bindings)).toBe(true);
  });
});
