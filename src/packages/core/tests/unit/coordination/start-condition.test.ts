/**
 * Start-condition expression constructors.
 *
 * The expression tree is the wire form a manifest carries into the content
 * store, so its shape is a contract with every evaluator registry that reads
 * it: an operator renamed here silently stops matching there.
 */
import { describe, expect, it } from "vitest";
import {
  ALWAYS_CONDITION,
  NEVER_CONDITION,
  conditionAnd,
  conditionAtom,
  conditionNot,
  conditionOr,
  normalizeStartCondition,
} from "../../../src/coordination/startCondition.js";

describe("atoms", () => {
  it("names the evaluator and carries its params", () => {
    expect(conditionAtom("agentsDone", { agents: ["a"] })).toEqual({
      operator: "atom",
      atom: { evaluator: "agentsDone", params: { agents: ["a"] } },
    });
  });

  it("defaults params to an empty object for a parameterless evaluator", () => {
    expect(conditionAtom("always")).toEqual({
      operator: "atom",
      atom: { evaluator: "always", params: {} },
    });
  });
});

describe("logical operators", () => {
  it("builds and/or over any number of operands", () => {
    const a = conditionAtom("a");
    const b = conditionAtom("b");
    expect(conditionAnd(a, b)).toEqual({ operator: "and", operands: [a, b] });
    expect(conditionOr(a, b)).toEqual({ operator: "or", operands: [a, b] });
  });

  it("permits an empty operand list, which the registry resolves", () => {
    expect(conditionAnd()).toEqual({ operator: "and", operands: [] });
    expect(conditionOr()).toEqual({ operator: "or", operands: [] });
  });

  it("wraps a single operand in not", () => {
    const a = conditionAtom("a");
    expect(conditionNot(a)).toEqual({ operator: "not", operand: a });
  });

  it("nests to arbitrary depth", () => {
    const tree = conditionAnd(
      conditionOr(conditionAtom("x"), conditionNot(conditionAtom("y"))),
      conditionAtom("z"),
    );
    expect(tree.operator).toBe("and");
    if (tree.operator !== "and") return;
    expect(tree.operands).toHaveLength(2);
    expect(tree.operands[0]?.operator).toBe("or");
  });
});

describe("well-known conditions", () => {
  it("ALWAYS and NEVER are the named atoms every registry registers", () => {
    expect(ALWAYS_CONDITION).toEqual(conditionAtom("always"));
    expect(NEVER_CONDITION).toEqual(conditionAtom("never"));
  });
});

describe("normalizeStartCondition", () => {
  it("treats missing, empty, and prose as always so an undeclared condition starts", () => {
    expect(normalizeStartCondition(undefined)).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition(null)).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition("")).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition("   ")).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition("artifacts/architecture.md exists")).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition(42)).toEqual(ALWAYS_CONDITION);
  });

  it("accepts well-known aliases and a bare evaluator atom", () => {
    expect(normalizeStartCondition("always")).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition("NEVER")).toEqual(NEVER_CONDITION);
    expect(normalizeStartCondition({ evaluator: "agentsDone", params: { agents: ["a"] } })).toEqual(
      conditionAtom("agentsDone", { agents: ["a"] }),
    );
  });

  it("keeps a typed expression tree and normalizes nested operands", () => {
    const tree = conditionAnd(
      conditionAtom("agentsDone", { agents: ["a"] }),
      conditionNot(conditionAtom("never")),
    );
    expect(normalizeStartCondition(tree)).toEqual(tree);
    expect(
      normalizeStartCondition({
        operator: "or",
        operands: [{ evaluator: "always" }, ""],
      }),
    ).toEqual(conditionOr(ALWAYS_CONDITION, ALWAYS_CONDITION));
  });

  it("does not invent an evaluator for an atom missing its name", () => {
    expect(normalizeStartCondition({ operator: "atom", atom: {} })).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition({ operator: "atom", atom: null })).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition({ unexpected: true })).toEqual(ALWAYS_CONDITION);
    expect(normalizeStartCondition({ operator: "and" })).toEqual(conditionAnd());
  });
});
