import { describe, it, expect } from "vitest";
import { actorId, collaborationSnapshot, snapshotRef, epochId, participant } from "@cantilune/core";
import {
  conditionAtom,
  conditionAnd,
  conditionOr,
  conditionNot,
  ALWAYS_CONDITION,
  NEVER_CONDITION,
} from "@cantilune/core";
import type { ParticipationStatus } from "@cantilune/core";
import {
  createDefaultConditionRegistry,
  InMemoryConditionEvaluatorRegistry,
} from "../../../src/cluster/conditionEvaluatorRegistry.js";

function makeSnapshot(participants: [string, string][]) {
  const map = new Map(
    participants.map(([id, status]) => [
      actorId(id),
      participant(actorId(id), "agent", status as ParticipationStatus),
    ]),
  );
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s1"),
    epochId: epochId("e1"),
    participants: map,
  });
}

describe("ConditionEvaluatorRegistry", () => {
  describe("atom evaluation", () => {
    it("always evaluator returns true", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = { snapshot: makeSnapshot([["a", "active"]]), targetAgent: actorId("a") };
      expect(registry.evaluate(ALWAYS_CONDITION, ctx)).toBe(true);
    });

    it("never evaluator returns false", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = { snapshot: makeSnapshot([["a", "active"]]), targetAgent: actorId("a") };
      expect(registry.evaluate(NEVER_CONDITION, ctx)).toBe(false);
    });

    it("agentsDone returns true when all specified agents are done", () => {
      const registry = createDefaultConditionRegistry();
      const snapshot = makeSnapshot([
        ["a", "active"],
        ["c", "done"],
        ["d", "done"],
        ["e", "retired"],
      ]);
      const ctx = { snapshot, targetAgent: actorId("f") };
      const expr = conditionAtom("agentsDone", { agents: ["c", "d", "e"] });
      expect(registry.evaluate(expr, ctx)).toBe(true);
    });

    it("agentsDone returns false when some agents are still active", () => {
      const registry = createDefaultConditionRegistry();
      const snapshot = makeSnapshot([
        ["a", "active"],
        ["c", "done"],
        ["d", "active"],
      ]);
      const ctx = { snapshot, targetAgent: actorId("f") };
      const expr = conditionAtom("agentsDone", { agents: ["c", "d"] });
      expect(registry.evaluate(expr, ctx)).toBe(false);
    });

    it("agentsActive returns true when all specified agents are active", () => {
      const registry = createDefaultConditionRegistry();
      const snapshot = makeSnapshot([
        ["a", "active"],
        ["b", "active"],
      ]);
      const ctx = { snapshot, targetAgent: actorId("c") };
      const expr = conditionAtom("agentsActive", { agents: ["a", "b"] });
      expect(registry.evaluate(expr, ctx)).toBe(true);
    });

    it("unknown evaluator returns false gracefully", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = { snapshot: makeSnapshot([["a", "active"]]), targetAgent: actorId("a") };
      const expr = conditionAtom("nonexistent_evaluator", {});
      expect(registry.evaluate(expr, ctx)).toBe(false);
    });
  });

  describe("composite expressions", () => {
    it("AND with all true operands returns true", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = {
        snapshot: makeSnapshot([
          ["a", "done"],
          ["b", "done"],
        ]),
        targetAgent: actorId("c"),
      };
      const expr = conditionAnd(
        conditionAtom("agentsDone", { agents: ["a"] }),
        conditionAtom("agentsDone", { agents: ["b"] }),
      );
      expect(registry.evaluate(expr, ctx)).toBe(true);
    });

    it("AND with one false operand returns false", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = {
        snapshot: makeSnapshot([
          ["a", "done"],
          ["b", "active"],
        ]),
        targetAgent: actorId("c"),
      };
      const expr = conditionAnd(
        conditionAtom("agentsDone", { agents: ["a"] }),
        conditionAtom("agentsDone", { agents: ["b"] }),
      );
      expect(registry.evaluate(expr, ctx)).toBe(false);
    });

    it("OR with at least one true operand returns true", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = {
        snapshot: makeSnapshot([
          ["a", "done"],
          ["b", "active"],
        ]),
        targetAgent: actorId("c"),
      };
      const expr = conditionOr(
        conditionAtom("agentsDone", { agents: ["a"] }),
        conditionAtom("agentsDone", { agents: ["b"] }),
      );
      expect(registry.evaluate(expr, ctx)).toBe(true);
    });

    it("OR with all false operands returns false", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = {
        snapshot: makeSnapshot([
          ["a", "active"],
          ["b", "active"],
        ]),
        targetAgent: actorId("c"),
      };
      const expr = conditionOr(
        conditionAtom("agentsDone", { agents: ["a"] }),
        conditionAtom("agentsDone", { agents: ["b"] }),
      );
      expect(registry.evaluate(expr, ctx)).toBe(false);
    });

    it("NOT inverts the result", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = { snapshot: makeSnapshot([["a", "active"]]), targetAgent: actorId("b") };
      expect(registry.evaluate(conditionNot(ALWAYS_CONDITION), ctx)).toBe(false);
      expect(registry.evaluate(conditionNot(NEVER_CONDITION), ctx)).toBe(true);
    });

    it("deeply nested expression evaluates correctly", () => {
      const registry = createDefaultConditionRegistry();
      const ctx = {
        snapshot: makeSnapshot([
          ["a", "done"],
          ["b", "active"],
          ["c", "done"],
        ]),
        targetAgent: actorId("d"),
      };
      const expr = conditionAnd(
        conditionOr(
          conditionAtom("agentsDone", { agents: ["a"] }),
          conditionAtom("agentsDone", { agents: ["b"] }),
        ),
        conditionNot(conditionAtom("agentsDone", { agents: ["b"] })),
      );
      expect(registry.evaluate(expr, ctx)).toBe(true);
    });
  });

  describe("dynamic registration", () => {
    it("custom evaluator works after registration", () => {
      const registry = new InMemoryConditionEvaluatorRegistry();
      registry.register("customCheck", (params) => {
        return params["value"] === "expected";
      });
      const ctx = { snapshot: makeSnapshot([["a", "active"]]), targetAgent: actorId("a") };
      const expr = conditionAtom("customCheck", { value: "expected" });
      expect(registry.evaluate(expr, ctx)).toBe(true);
    });
  });
});
