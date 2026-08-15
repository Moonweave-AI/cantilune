import { describe, expect, it } from "vitest";
import { matchWitnessFromBindings, verifyMatchWitness } from "../../../src/replay/matchWitness.js";
import { matchBinding } from "@cantilune/core";

describe("matchWitness", () => {
  it("builds identity embedding from bindings", () => {
    const bindings = [matchBinding("task", "task-T"), matchBinding("from", "planner-p")];
    const witness = matchWitnessFromBindings(bindings);
    expect(witness.domainSize).toBe(2);
    expect(witness.embedding).toEqual([0, 1]);
  });

  it("rejects domain size mismatch", () => {
    const witness = { domainSize: 2, codomainSize: 3, embedding: [0, 1] };
    expect(verifyMatchWitness(witness, [matchBinding("task", "task-T")])).toBe(false);
  });

  it("rejects codomain smaller than domain", () => {
    const witness = { domainSize: 2, codomainSize: 1, embedding: [0, 0] };
    expect(
      verifyMatchWitness(witness, [
        matchBinding("task", "task-T"),
        matchBinding("from", "planner-p"),
      ]),
    ).toBe(false);
  });

  it("rejects out-of-range embedding index", () => {
    const witness = { domainSize: 2, codomainSize: 2, embedding: [0, 5] };
    expect(
      verifyMatchWitness(witness, [
        matchBinding("task", "task-T"),
        matchBinding("from", "planner-p"),
      ]),
    ).toBe(false);
  });

  it("rejects duplicate embedding indices", () => {
    const witness = { domainSize: 2, codomainSize: 3, embedding: [0, 0] };
    expect(
      verifyMatchWitness(witness, [
        matchBinding("task", "task-T"),
        matchBinding("from", "planner-p"),
      ]),
    ).toBe(false);
  });

  it("accepts valid witness", () => {
    const bindings = [matchBinding("task", "task-T"), matchBinding("from", "planner-p")];
    const witness = matchWitnessFromBindings(bindings);
    expect(verifyMatchWitness(witness, bindings)).toBe(true);
  });
});
