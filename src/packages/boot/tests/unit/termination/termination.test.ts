import { describe, it, expect } from "vitest";
import {
  createDefaultVerifierRegistry,
  defaultSystemContract,
  decide,
  estimateVOC,
  computeResidual,
  collectAgentState,
  COORDINATION_PROGRESS_VERIFIER,
  NO_INFINITE_LOOP_VERIFIER,
} from "../../../src/termination/index.js";
import { compileGoalContract } from "../../../src/termination/goalContract.js";
import { createTerminationController } from "../../../src/termination/index.js";
import type {
  GoalContract,
  AgentState,
  CriterionEvaluation,
  CandidateAction,
  ControllerThresholds,
} from "../../../src/termination/types.js";
import { DEFAULT_THRESHOLDS } from "../../../src/termination/types.js";

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  const base: AgentState = {
    environment: {
      worldSummary: "World is empty.",
      headRef: undefined,
      epochId: "boot-epoch-1",
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
      recentAssistantTexts: ["Hello! I am the Cantilune agent."],
      committedOperations: 0,
      rejectedOperations: 0,
    },
    pendingReply: { text: "Hello! I am the Cantilune agent.", hasToolCalls: false },
    ...overrides,
  };
  return base;
}

function contractWith(criteria: GoalContract["criteria"]): GoalContract {
  return {
    contractId: "sha256:test",
    instruction: "test",
    criteria,
    frozenAt: "2026-01-01T00:00:00.000Z",
    compiledBy: "system",
  };
}

describe("VerifierRegistry", () => {
  it("registers and evaluates built-in verifiers", () => {
    const registry = createDefaultVerifierRegistry();
    expect(registry.has("no_infinite_loop")).toBe(true);
    expect(registry.has("duplicate_reply")).toBe(true);
    expect(registry.has("coordination_progress")).toBe(true);
  });

  it("fails closed for an unknown verifier", () => {
    const registry = createDefaultVerifierRegistry();
    const eval_ = registry.evaluate("nonexistent", {
      id: "c1",
      description: "x",
      kind: "hard",
      weight: 1,
      threshold: 1,
      verifierId: "nonexistent",
    }, makeState());
    expect(eval_.q).toBe(0);
    expect(eval_.passed).toBe(false);
  });
});

describe("no_infinite_loop verifier", () => {
  it("passes for a single distinct reply", () => {
    const eval_ = NO_INFINITE_LOOP_VERIFIER.evaluate(
      { id: "c", description: "no loop", kind: "hard", weight: 1, threshold: 1, verifierId: "no_infinite_loop" },
      makeState(),
    );
    expect(eval_.passed).toBe(true);
    expect(eval_.q).toBe(1);
  });

  it("fails when stuck in repeated plain-text turns with no progress", () => {
    const eval_ = NO_INFINITE_LOOP_VERIFIER.evaluate(
      { id: "c", description: "no loop", kind: "hard", weight: 1, threshold: 1, verifierId: "no_infinite_loop" },
      makeState({
        trace: {
          conversationTurns: 4,
          plainTextTurns: 4,
          toolCallTurns: 0,
          recentAssistantTexts: [
            "您好！我是Cantilune协调系统的自主代理",
            "您好！我是Cantilune协调系统的自主代理",
            "您好！我是Cantilune协调系统的自主代理",
            "您好！我是Cantilune协调系统的自主代理",
          ],
          committedOperations: 0,
          rejectedOperations: 0,
        },
      }),
    );
    expect(eval_.passed).toBe(false);
    expect(eval_.q).toBe(0);
  });
});

describe("coordination_progress verifier", () => {
  it("fails with no committed operations", () => {
    const eval_ = COORDINATION_PROGRESS_VERIFIER.evaluate(
      { id: "c", description: "progress", kind: "hard", weight: 1, threshold: 1, verifierId: "coordination_progress" },
      makeState({ trace: { ...makeState().trace, committedOperations: 0 } }),
    );
    expect(eval_.passed).toBe(false);
  });

  it("passes once an operation is committed", () => {
    const eval_ = COORDINATION_PROGRESS_VERIFIER.evaluate(
      { id: "c", description: "progress", kind: "hard", weight: 1, threshold: 1, verifierId: "coordination_progress" },
      makeState({ trace: { ...makeState().trace, committedOperations: 1 } }),
    );
    expect(eval_.passed).toBe(true);
  });
});

describe("goalContract compiler", () => {
  it("produces a frozen default contract with no LLM", async () => {
    const registry = createDefaultVerifierRegistry();
    const contract = defaultSystemContract("你好", "2026-01-01T00:00:00.000Z");
    expect(contract.compiledBy).toBe("system");
    expect(contract.criteria).toHaveLength(1);
    expect(contract.criteria[0]?.verifierId).toBe("no_infinite_loop");
    expect(registry.has(contract.criteria[0]!.verifierId)).toBe(true);
  });

  it("falls back to default when LLM draft is malformed", async () => {
    const registry = createDefaultVerifierRegistry();
    const badLlm = {
      async chat() {
        return { text: "not json", toolCalls: [], finishReason: "stop" as const };
      },
    };
    const contract = await compileGoalContract("test", badLlm, registry, "2026-01-01T00:00:00.000Z");
    expect(contract.compiledBy).toBe("system");
  });
});

describe("valueOfContinuation", () => {
  it("returns star=0 for no candidate actions", () => {
    const contract = contractWith([
      { id: "c", description: "x", kind: "hard", weight: 1, threshold: 1, verifierId: "no_infinite_loop" },
    ]);
    const evaluations: CriterionEvaluation[] = [
      { criterionId: "c", q: 0, rho: 1, passed: false, evidenceRefs: [], rationale: "" },
    ];
    const voc = estimateVOC(contract, evaluations, [], DEFAULT_THRESHOLDS);
    expect(voc.star).toBe(0);
  });

  it("rates a coordination action higher when progress is unmet", () => {
    const contract = contractWith([
      { id: "c", description: "x", kind: "hard", weight: 1, threshold: 1, verifierId: "coordination_progress" },
    ]);
    const evaluations: CriterionEvaluation[] = [
      { criterionId: "c", q: 0, rho: 1, passed: false, evidenceRefs: [], rationale: "" },
    ];
    const actions: CandidateAction[] = [
      { name: "introduce_artifact", kind: "coordination" },
      { name: "say_hi", kind: "text" },
    ];
    const voc = estimateVOC(contract, evaluations, actions, DEFAULT_THRESHOLDS);
    expect(voc.star).toBeGreaterThan(0);
    expect(voc.bestAction).toBe("introduce_artifact");
  });
});

describe("semanticResidual", () => {
  it("returns full residual when no evidence exists", async () => {
    const contract = contractWith([
      { id: "c", description: "cover the topic", kind: "soft", weight: 1, threshold: 1, verifierId: "structured_rubric" },
    ]);
    const result = await computeResidual(contract, makeState({ evidence: { items: [] }, pendingReply: { text: "", hasToolCalls: false } }), undefined);
    expect(result.residual).toHaveLength(1);
    expect(result.residual[0]).toBe(1);
    expect(result.usedEmbeddings).toBe(false);
  });

  it("reduces residual when evidence matches a goal", async () => {
    const contract = contractWith([
      { id: "c", description: "write a poem", kind: "soft", weight: 1, threshold: 1, verifierId: "structured_rubric" },
    ]);
    const state = makeState({
      pendingReply: { text: "Here is a poem about the moon", hasToolCalls: false },
    });
    const result = await computeResidual(contract, state, undefined);
    expect(result.residual[0]).toBeLessThan(1);
  });
});

describe("terminationStateMachine.decide", () => {
  const thresholds: ControllerThresholds = DEFAULT_THRESHOLDS;

  it("verdicts DONE when hard gate open, completion high, uncertainty low, no worthwhile action", () => {
    const contract = contractWith([
      { id: "c", description: "no loop", kind: "hard", weight: 1, threshold: 1, verifierId: "no_infinite_loop" },
    ]);
    const evaluations: CriterionEvaluation[] = [
      { criterionId: "c", q: 1, rho: 1, passed: true, evidenceRefs: [], rationale: "" },
    ];
    const verdict = decide({
      contract,
      evaluations,
      voc: { perAction: new Map(), star: 0, bestAction: undefined },
      residual: [0],
      thresholds,
      llmDoneSignal: false,
    });
    expect(verdict.kind).toBe("DONE");
  });

  it("verdicts CONTINUE when a worthwhile action exists", () => {
    const contract = contractWith([
      { id: "c", description: "progress", kind: "hard", weight: 1, threshold: 1, verifierId: "coordination_progress" },
    ]);
    const evaluations: CriterionEvaluation[] = [
      { criterionId: "c", q: 0, rho: 1, passed: false, evidenceRefs: [], rationale: "" },
    ];
    const verdict = decide({
      contract,
      evaluations,
      voc: { perAction: new Map([["introduce_artifact", 0.5]]), star: 0.5, bestAction: "introduce_artifact" },
      residual: [1],
      thresholds,
      llmDoneSignal: false,
    });
    expect(verdict.kind).toBe("CONTINUE");
  });

  it("verdicts VERIFY when completion high but uncertainty high", () => {
    // q=1 (satisfied) but rho=0.1 (under-evidenced). With C and U decoupled,
    // C = Σwq/Σw = 1.0 >= τ_C while U = Σw(1-ρ)/Σw = 0.9 > τ_U → VERIFY.
    // This is the "looks satisfied but evidence insufficient" state.
    const contract = contractWith([
      { id: "c", description: "soft goal", kind: "soft", weight: 1, threshold: 0.05, verifierId: "structured_rubric" },
    ]);
    const evaluations: CriterionEvaluation[] = [
      { criterionId: "c", q: 1, rho: 0.1, passed: true, evidenceRefs: [], rationale: "" },
    ];
    const verdict = decide({
      contract,
      evaluations,
      voc: { perAction: new Map(), star: 0, bestAction: undefined },
      residual: [0.5],
      thresholds,
      llmDoneSignal: false,
    });
    expect(verdict.kind).toBe("VERIFY");
  });

  it("never verdicts DONE when a hard condition fails", () => {
    const contract = contractWith([
      { id: "c", description: "hard", kind: "hard", weight: 1, threshold: 1, verifierId: "no_infinite_loop" },
    ]);
    const evaluations: CriterionEvaluation[] = [
      { criterionId: "c", q: 0, rho: 1, passed: false, evidenceRefs: [], rationale: "" },
    ];
    const verdict = decide({
      contract,
      evaluations,
      voc: { perAction: new Map(), star: 0, bestAction: undefined },
      residual: [1],
      thresholds,
      llmDoneSignal: true, // LLM claims done but hard gate closed
    });
    expect(verdict.kind).not.toBe("DONE");
  });
});

describe("createTerminationController", () => {
  it("compiles and caches one contract per controller", async () => {
    const controller = createTerminationController({});
    const c1 = await controller.compileContract("hello");
    const c2 = await controller.compileContract("hello");
    expect(c1).toBe(c2);
    expect(controller.contract()).toBe(c1);
  });
});

describe("collectAgentState", () => {
  it("projects messages into tiered evidence", () => {
    const state = collectAgentState({
      world: {
        worldSummary: "empty",
        headRef: undefined,
        epochId: "e1",
        participantCount: 1,
        artifactCount: 0,
        auditTailLength: 0,
      },
      traceCounts: {
        conversationTurns: 1,
        plainTextTurns: 1,
        toolCallTurns: 0,
        recentAssistantTexts: ["hi"],
        committedOperations: 0,
        rejectedOperations: 0,
      },
      produce: { artifactIds: [], contentRefs: ["sha256:abc"] },
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "tool", toolCallId: "t1", content: "result" },
      ],
      pendingReply: { text: "hi", hasToolCalls: false },
    });
    expect(state.evidence.items.length).toBe(4); // 2 messages + 1 content ref
    expect(state.artifacts.contentRefs).toContain("sha256:abc");
  });
});
