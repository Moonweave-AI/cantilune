import { describe, expect, it } from "vitest";
import {
  denyByDefaultPolicyEvaluator,
  templateAwarePolicyEvaluator,
} from "../../../src/ports/policyEvaluator.js";
import { buildConfigT0, storyActorIds } from "@cantilune/test-fixtures";
import {
  actorId,
  actorRef,
  coordinationIntent,
  emptyFootprint,
  matchBinding,
  operationTypeId,
  participant,
} from "@cantilune/core";
import { defaultIntroduceTemplate } from "../../../src/schema/defaultSchema.js";

describe("policy evaluators", () => {
  const snapshot = buildConfigT0();
  const template = defaultIntroduceTemplate();
  const intent = coordinationIntent(
    actorRef(actorId("planner-p"), "agent"),
    operationTypeId("introduce_artifact"),
    [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
  );
  const input = {
    snapshot,
    intent,
    template,
    effectiveFootprint: emptyFootprint(),
  };

  it("denyByDefaultPolicyEvaluator always denies", () => {
    const decision = denyByDefaultPolicyEvaluator().evaluate(input);
    expect(decision.kind).toBe("deny");
  });

  it("templateAwarePolicyEvaluator allows with empty authorization", () => {
    const decision = templateAwarePolicyEvaluator().evaluate(input);
    expect(decision.kind).toBe("allow");
    if (decision.kind === "allow") {
      expect(decision.authorization).toEqual([]);
    }
  });

  it("templateAwarePolicyEvaluator denies operation type mismatch", () => {
    const mismatched = coordinationIntent(
      intent.initiator,
      operationTypeId("delegate"),
      intent.matchBindings,
    );
    const decision = templateAwarePolicyEvaluator().evaluate({ ...input, intent: mismatched });
    expect(decision).toEqual({
      kind: "deny",
      reason: "operation type mismatch: intent delegate vs template introduce_artifact",
    });
  });

  it("templateAwarePolicyEvaluator denies missing initiator participant", () => {
    const decision = templateAwarePolicyEvaluator().evaluate({
      ...input,
      intent: coordinationIntent(
        actorRef(actorId("unknown"), "agent"),
        intent.operationTypeId,
        intent.matchBindings,
      ),
    });
    expect(decision).toEqual({
      kind: "deny",
      reason: "initiator unknown not found in participants",
    });
  });

  it("templateAwarePolicyEvaluator denies inactive initiator", () => {
    const blockedSnapshot = {
      ...snapshot,
      participants: new Map([
        ...snapshot.participants,
        [storyActorIds.planner, participant(storyActorIds.planner, "agent", "blocked")],
      ]),
    };
    const decision = templateAwarePolicyEvaluator().evaluate({
      ...input,
      snapshot: blockedSnapshot,
    });
    expect(decision).toEqual({
      kind: "deny",
      reason: "initiator planner-p status is blocked, not active",
    });
  });

  it("templateAwarePolicyEvaluator denies missing required role binding", () => {
    const decision = templateAwarePolicyEvaluator().evaluate({
      ...input,
      intent: coordinationIntent(intent.initiator, intent.operationTypeId, [
        matchBinding("task", "task-T"),
      ]),
    });
    expect(decision).toEqual({
      kind: "deny",
      reason: "missing required role binding: from",
    });
  });
});
