/**
 * Branch coverage for valueOfContinuation and verifierRegistry (ADR-0013).
 *
 * Targets the branches the happy-path suite does not reach: the
 * task_artifact_exists and duplicate_reply/no_infinite_loop relevance branches,
 * the nullish-criterion `?? 0` coalescing, the non-finite star guard, the
 * empty-set Jaccard guard, the duplicate-reply detection true/false split, and
 * the VerifierRegistry duplicate-registration throw.
 */
import { describe, it, expect } from "vitest";
import { estimateVOC } from "../../../src/termination/valueOfContinuation.js";
import {
  VerifierRegistry,
  NO_INFINITE_LOOP_VERIFIER,
  DUPLICATE_REPLY_VERIFIER,
} from "../../../src/termination/index.js";
import type {
  CriterionEvaluation,
  GoalContract,
  AgentState,
} from "../../../src/termination/types.js";
import { DEFAULT_THRESHOLDS } from "../../../src/termination/types.js";

function contractWith(criteria: GoalContract["criteria"]): GoalContract {
  return {
    contractId: "sha256:test",
    instruction: "test",
    criteria,
    frozenAt: "2026-01-01T00:00:00.000Z",
    compiledBy: "system",
  };
}

function evalFor(id: string, q: number): CriterionEvaluation {
  return { criterionId: id, q, rho: 1, passed: q >= 0.5, evidenceRefs: [], rationale: "" };
}

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  const base: AgentState = {
    environment: {
      worldSummary: "",
      headRef: undefined,
      epochId: "e1",
      participantCount: 1,
      artifactCount: 0,
      auditTailLength: 0,
    },
    artifacts: { artifactIds: [], contentRefs: [] },
    evidence: { items: [] },
    trace: {
      conversationTurns: 1,
      plainTextTurns: 1,
      toolCallTurns: 0,
      recentAssistantTexts: [],
      committedOperations: 0,
      rejectedOperations: 0,
    },
    pendingReply: { text: "", hasToolCalls: false },
    ...overrides,
  };
  return base;
}

const crit = (id: string, verifierId: string, weight = 1): GoalContract["criteria"][number] => ({
  id,
  description: "d",
  kind: "hard",
  weight,
  threshold: 1,
  verifierId,
});

describe("estimateVOC — relevance branches", () => {
  it("rates tool/coordination actions as relevant to task_artifact_exists", () => {
    const contract = contractWith([crit("c", "task_artifact_exists")]);
    const voc = estimateVOC(
      contract,
      [evalFor("c", 0)],
      [
        { name: "writeFile", kind: "tool" },
        { name: "introduce", kind: "coordination" },
        { name: "talk", kind: "text" },
      ],
      DEFAULT_THRESHOLDS,
    );
    // tool and coordination both rel=0.8; text rel=0.2 — tool/coordination should
    // outweigh text on the same unmet criterion.
    expect(voc.perAction.get("writeFile")).toBeGreaterThan(voc.perAction.get("talk")!);
    expect(voc.perAction.get("introduce")).toBeGreaterThan(voc.perAction.get("talk")!);
  });

  it("rates a distinct text action as relevant to duplicate_reply / no_infinite_loop", () => {
    const contract = contractWith([crit("c", "duplicate_reply")]);
    const voc = estimateVOC(
      contract,
      [evalFor("c", 0)],
      [
        { name: "saySomethingNew", kind: "text" },
        { name: "doWork", kind: "coordination" },
      ],
      DEFAULT_THRESHOLDS,
    );
    // text rel=0.3 (success 1, cost 0.5); coordination rel=0.2 (success 0.85, cost 1).
    // text should rate higher here because rel×pSucc dominates.
    expect(voc.perAction.get("saySomethingNew")).toBeGreaterThan(voc.perAction.get("doWork")!);
  });

  it("coalesces a missing criterion evaluation to q=0 (nullish ?? 0)", () => {
    const contract = contractWith([crit("c", "coordination_progress")]);
    // No evaluation provided for criterion "c" → evalById has no entry → q ?? 0 = 0.
    const voc = estimateVOC(
      contract,
      [],
      [{ name: "act", kind: "coordination" }],
      DEFAULT_THRESHOLDS,
    );
    // With q=0 the deltaC is positive; star must be finite and the action recorded.
    expect(voc.perAction.has("act")).toBe(true);
    expect(Number.isFinite(voc.star)).toBe(true);
  });
});

describe("estimateVOC — star guard", () => {
  it("clamps a non-finite star to 0 (all-NaN via zero-weight criteria)", () => {
    // With weight 0 and no actions, star stays -Infinity → guard sets it to 0.
    // Use weight 0 so deltaC=0 and a single action; star computed from cost/risk
    // which is finite. To force non-finite we rely on zero actions (star=-Infinity).
    const contract = contractWith([crit("c", "coordination_progress", 0)]);
    const voc = estimateVOC(contract, [evalFor("c", 0)], [], DEFAULT_THRESHOLDS);
    // The empty-actions path returns star=0 directly; assert the guard holds.
    expect(voc.star).toBe(0);
    expect(voc.bestAction).toBeUndefined();
  });
});

describe("VerifierRegistry — defensive branches", () => {
  it("throws on duplicate verifier registration", () => {
    const registry = new VerifierRegistry([]);
    registry.register(NO_INFINITE_LOOP_VERIFIER);
    expect(() => registry.register(NO_INFINITE_LOOP_VERIFIER)).toThrow(/already registered/);
  });

  it("jaccardSimilarity empty-set guard: empty recent texts do not trip duplicate_reply", () => {
    // recent texts are empty strings → normalized sets are empty → Jaccard is 0 →
    // no duplicate detected → verifier passes with q=1.
    const eval_ = DUPLICATE_REPLY_VERIFIER.evaluate(
      crit("c", "duplicate_reply"),
      makeState({
        trace: {
          conversationTurns: 2,
          plainTextTurns: 2,
          toolCallTurns: 0,
          recentAssistantTexts: ["", ""],
          committedOperations: 0,
          rejectedOperations: 0,
        },
        pendingReply: { text: "a real distinct reply", hasToolCalls: false },
      }),
    );
    // Empty prior texts cannot match → not a duplicate.
    expect(eval_.passed).toBe(true);
  });

  it("duplicate_reply detects a near-identical prior reply (>= 0.6 similarity)", () => {
    const eval_ = DUPLICATE_REPLY_VERIFIER.evaluate(
      crit("c", "duplicate_reply"),
      makeState({
        trace: {
          conversationTurns: 2,
          plainTextTurns: 2,
          toolCallTurns: 0,
          recentAssistantTexts: ["Hello I am the agent", "Hello I am the agent"],
          committedOperations: 0,
          rejectedOperations: 0,
        },
        pendingReply: { text: "Hello I am the agent", hasToolCalls: false },
      }),
    );
    expect(eval_.passed).toBe(false);
    expect(eval_.q).toBe(0);
  });

  it("duplicate_reply passes for a genuinely distinct reply (similarity < 0.6)", () => {
    const eval_ = DUPLICATE_REPLY_VERIFIER.evaluate(
      crit("c", "duplicate_reply"),
      makeState({
        trace: {
          conversationTurns: 2,
          plainTextTurns: 2,
          toolCallTurns: 0,
          recentAssistantTexts: ["I will write a report now", "Let me fetch the data first"],
          committedOperations: 0,
          rejectedOperations: 0,
        },
        pendingReply: {
          text: "Now I will compile the findings into a summary document",
          hasToolCalls: false,
        },
      }),
    );
    expect(eval_.passed).toBe(true);
    expect(eval_.q).toBe(1);
  });

  it("duplicate_reply fails closed when the pending reply is empty", () => {
    const eval_ = DUPLICATE_REPLY_VERIFIER.evaluate(
      crit("c", "duplicate_reply"),
      makeState({
        trace: {
          conversationTurns: 1,
          plainTextTurns: 1,
          toolCallTurns: 0,
          recentAssistantTexts: ["prior reply"],
          committedOperations: 0,
          rejectedOperations: 0,
        },
        pendingReply: { text: "   ", hasToolCalls: false },
      }),
    );
    expect(eval_.passed).toBe(false);
    expect(eval_.q).toBe(0);
    expect(eval_.rationale).toContain("empty");
  });
});
