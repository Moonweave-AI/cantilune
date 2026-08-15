/**
 * LLM Judge Verifier tests (ADR-0020).
 *
 * Exercises the central design constraints:
 * - async pre-pass populates a per-tick cache the synchronous evaluate reads
 * - cache miss fails closed (ρ=0.3 placeholder)
 * - q is clamped to [0,1]; unparseable output → q=0/ρ=0.3 fail-closed
 * - the blinded prompt excludes the pending reply text
 * - multi-judge quorum aggregates by median + records inter-rater spread
 * - the pinned seed is derived from the contract digest (replay determinism)
 * - judge call records are sanitized into the audit journal
 * - integration: createTerminationController wires the judge into evaluateTurn
 */
import { describe, it, expect } from "vitest";
import {
  createJudgeVerifier,
  LLM_JUDGE_VERIFIER_ID,
  DEFAULT_JUDGE_RHO,
  JUDGE_PLACEHOLDER_RHO,
} from "../../../src/termination/judgeVerifier.js";
import { createJudgeAuditJournal } from "../../../src/termination/judgeAudit.js";
import { createTerminationController } from "../../../src/termination/index.js";
import type {
  AcceptanceCriterion,
  AgentState,
  GoalContract,
  JudgeCallRecord,
} from "../../../src/termination/types.js";
import type { LlmAdapter, LlmChatResponse } from "../../../src/types.js";

// --- fixtures ----------------------------------------------------------------

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
      recentAssistantTexts: [],
      committedOperations: 0,
      rejectedOperations: 0,
    },
    pendingReply: { text: "SECRET REPLY THE JUDGE MUST NOT SEE", hasToolCalls: false },
    ...overrides,
  };
  return base;
}

function judgeCriterion(overrides: Partial<AcceptanceCriterion> = {}): AcceptanceCriterion {
  return {
    id: "soft-answer-quality",
    description: "The agent must produce a substantive final answer.",
    kind: "soft",
    weight: 1,
    threshold: 0.5,
    verifierId: LLM_JUDGE_VERIFIER_ID,
    ...overrides,
  };
}

function contractWith(criteria: readonly AcceptanceCriterion[]): GoalContract {
  return {
    contractId: "sha256:test-contract-digest",
    instruction: "test",
    criteria,
    frozenAt: "2026-01-01T00:00:00.000Z",
    compiledBy: "system",
  };
}

function makeJudge(response: Partial<LlmChatResponse>): LlmAdapter {
  return {
    async chat() {
      return {
        text: response.text,
        toolCalls: response.toolCalls ?? [],
        finishReason: response.finishReason ?? "stop",
      };
    },
  };
}

function judgeJson(q: number, rationale = "looks fine"): string {
  return JSON.stringify({ q, rationale });
}

/** LLM that throws on chat — exercises the fail-closed catch. */
function throwingJudge(error: unknown): LlmAdapter {
  return {
    async chat() {
      throw error;
    },
  };
}

function makeSeedSource(digest = "sha256:test-contract-digest", tick = 1) {
  return {
    contractDigest: () => digest,
    tick: () => tick,
  };
}

// --- unit: judge verifier ----------------------------------------------------

describe("createJudgeVerifier — cache miss fails closed", () => {
  it("returns the ρ=0.3 placeholder when the cache has no entry for the criterion", () => {
    const judge = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: judgeJson(0.9) }) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    const result = judge.verifier.evaluate(crit, makeState());
    expect(result.q).toBe(0);
    expect(result.rho).toBe(JUDGE_PLACEHOLDER_RHO);
    expect(result.passed).toBe(false);
    expect(result.rationale).toContain("cache miss");
  });
});

describe("createJudgeVerifier — pre-pass populates the cache", () => {
  it("scores an llm_judge criterion from the LLM response after prepass", async () => {
    const judge = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: judgeJson(0.8) }) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    const contract = contractWith([crit]);
    await judge.cache.prepass(contract, makeState());
    const result = judge.verifier.evaluate(crit, makeState());
    expect(result.q).toBe(0.8);
    expect(result.rho).toBe(DEFAULT_JUDGE_RHO);
    expect(result.passed).toBe(0.8 * DEFAULT_JUDGE_RHO >= crit.threshold);
  });

  it("leaves non-llm_judge criteria untouched by the prepass", async () => {
    const judge = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: judgeJson(0.8) }) },
      makeSeedSource(),
    );
    const nonJudge = judgeCriterion({
      id: "hard-gate",
      verifierId: "no_infinite_loop",
      kind: "hard",
    });
    const contract = contractWith([nonJudge]);
    await judge.cache.prepass(contract, makeState());
    // No cache entry for a non-judge criterion.
    expect(judge.cache.read(nonJudge.id)).toBeUndefined();
  });
});

describe("createJudgeVerifier — q clamping", () => {
  it("clamps q above 1 down to 1", async () => {
    const judge = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: judgeJson(1.5) }) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    await judge.cache.prepass(contractWith([crit]), makeState());
    const result = judge.verifier.evaluate(crit, makeState());
    expect(result.q).toBe(1);
  });

  it("clamps q below 0 up to 0", async () => {
    const judge = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: judgeJson(-0.4) }) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    await judge.cache.prepass(contractWith([crit]), makeState());
    const result = judge.verifier.evaluate(crit, makeState());
    expect(result.q).toBe(0);
  });

  it("fails closed (q=0, ρ=0.3) on unparseable JSON", async () => {
    const judge = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: "this is not json" }) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    await judge.cache.prepass(contractWith([crit]), makeState());
    const result = judge.verifier.evaluate(crit, makeState());
    expect(result.q).toBe(0);
    expect(result.rho).toBe(JUDGE_PLACEHOLDER_RHO);
  });

  it("fails closed when the adapter throws", async () => {
    const judge = createJudgeVerifier(
      { judgeLlm: throwingJudge(new Error("network")) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    await judge.cache.prepass(contractWith([crit]), makeState());
    const result = judge.verifier.evaluate(crit, makeState());
    expect(result.q).toBe(0);
    expect(result.rho).toBe(JUDGE_PLACEHOLDER_RHO);
  });
});

describe("createJudgeVerifier — blinding", () => {
  it("the prompt never contains the pending reply text", async () => {
    let capturedPrompt = "";
    const judge: LlmAdapter = {
      async chat(req) {
        capturedPrompt = req.messages.map((m) => m.content).join("\n");
        return { text: judgeJson(0.5), toolCalls: [], finishReason: "stop" };
      },
    };
    const state = makeState({
      pendingReply: { text: "UNIQUE_LEAKED_REPLY_MARKER_42", hasToolCalls: false },
    });
    const judgeVerifier = createJudgeVerifier({ judgeLlm: judge }, makeSeedSource());
    await judgeVerifier.cache.prepass(contractWith([judgeCriterion()]), state);
    expect(capturedPrompt).not.toContain("UNIQUE_LEAKED_REPLY_MARKER_42");
    // Sanity: the prompt does carry the criterion description.
    expect(capturedPrompt).toContain("substantive final answer");
  });
});

describe("createJudgeVerifier — multi-judge quorum", () => {
  it("aggregates q as the median across judges", async () => {
    const judges = [
      makeJudge({ text: judgeJson(0.2) }),
      makeJudge({ text: judgeJson(0.8) }),
      makeJudge({ text: judgeJson(0.6) }),
    ];
    const judgeVerifier = createJudgeVerifier(
      { judgeLlm: judges[0]!, judgeQuorum: judges.slice(1) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    await judgeVerifier.cache.prepass(contractWith([crit]), makeState());
    const result = judgeVerifier.verifier.evaluate(crit, makeState());
    // median of [0.2, 0.8, 0.6] = 0.6
    expect(result.q).toBeCloseTo(0.6, 5);
    expect(result.rationale).toContain("quorum");
    expect(result.rationale).toContain("n=3");
  });

  it("records inter-rater spread in the rationale", async () => {
    const judges = [makeJudge({ text: judgeJson(0.1) }), makeJudge({ text: judgeJson(0.9) })];
    const judgeVerifier = createJudgeVerifier(
      { judgeLlm: judges[0]!, judgeQuorum: judges.slice(1) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    await judgeVerifier.cache.prepass(contractWith([crit]), makeState());
    const result = judgeVerifier.verifier.evaluate(crit, makeState());
    expect(result.rationale).toContain("spread");
  });

  it("a single judge has no spread and no quorum label", async () => {
    const judgeVerifier = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: judgeJson(0.7) }) },
      makeSeedSource(),
    );
    const crit = judgeCriterion();
    await judgeVerifier.cache.prepass(contractWith([crit]), makeState());
    const result = judgeVerifier.verifier.evaluate(crit, makeState());
    expect(result.rationale).not.toContain("quorum");
    expect(result.rationale).not.toContain("spread");
  });
});

describe("createJudgeVerifier — pinned seed / replay determinism", () => {
  it("derives the same seed for the same contract digest + tick → same prompt", async () => {
    const capture = (): { adapter: LlmAdapter; prompt: () => string } => {
      let captured = "";
      const adapter: LlmAdapter = {
        async chat(req) {
          captured = req.messages.map((m) => m.content).join("\n");
          return { text: judgeJson(0.5), toolCalls: [], finishReason: "stop" };
        },
      };
      return { adapter, prompt: () => captured };
    };
    const a = capture();
    const b = capture();
    const seedSource = makeSeedSource("sha256:same-digest", 7);
    const va = createJudgeVerifier({ judgeLlm: a.adapter }, seedSource);
    const vb = createJudgeVerifier({ judgeLlm: b.adapter }, seedSource);
    const crit = judgeCriterion();
    await va.cache.prepass(contractWith([crit]), makeState());
    await vb.cache.prepass(contractWith([crit]), makeState());
    // Same digest + tick → same seed → identical prompt text.
    expect(a.prompt()).toBe(b.prompt());
    expect(a.prompt()).toContain("seed=");
  });
});

describe("createJudgeVerifier — audit journal", () => {
  it("flushes sanitized records to the journal (no raw prompt, digest only)", async () => {
    const judgeVerifier = createJudgeVerifier(
      { judgeLlm: makeJudge({ text: judgeJson(0.9, "good") }) },
      makeSeedSource(),
    );
    const journal = createJudgeAuditJournal();
    const crit = judgeCriterion();
    await judgeVerifier.cache.prepass(contractWith([crit]), makeState());
    judgeVerifier.cache.flushTo(journal);
    const records = journal.peek();
    expect(records).toHaveLength(1);
    const rec: JudgeCallRecord = records[0]!;
    expect(rec.criterionId).toBe(crit.id);
    expect(rec.promptDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.modelId).toBe("judge-primary");
    expect(rec.seed).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.rawQ).toBe(0.9);
    expect(rec.rawRationale).toBe("good");
    expect(rec.clamped).toBe(false);
    expect(rec.fellBack).toBe(false);
    // Sanitized: no raw prompt text stored on the record.
    expect(JSON.stringify(rec)).not.toContain("substantive final answer");
  });

  it("marks a record fellBack when the judge adapter throws", async () => {
    const judgeVerifier = createJudgeVerifier(
      { judgeLlm: throwingJudge(new Error("boom")) },
      makeSeedSource(),
    );
    const journal = createJudgeAuditJournal();
    await judgeVerifier.cache.prepass(contractWith([judgeCriterion()]), makeState());
    judgeVerifier.cache.flushTo(journal);
    const rec = journal.peek()[0]!;
    expect(rec.fellBack).toBe(true);
    // On fallback there is no parseable judge output, so rawQ is undefined
    // (the clamped value is recoverable from q, which is 0 — ADR-0020 §6).
    expect(rec.rawQ).toBeUndefined();
  });
});

// --- integration: createTerminationController wiring -------------------------

describe("createTerminationController — judge integration", () => {
  it("attaches judgeRecords to the verdict audit when a judge is configured", async () => {
    const controller = createTerminationController({
      judgeLlm: makeJudge({ text: judgeJson(0.9) }),
    });
    const contract = contractWith([judgeCriterion()]);
    const verdict = await controller.evaluateTurn({
      contract,
      state: makeState(),
      candidateActions: [],
      llmDoneSignal: false,
    });
    expect(verdict.audit.judgeRecords).toBeDefined();
    expect(verdict.audit.judgeRecords).toHaveLength(1);
    expect(verdict.audit.judgeRecords![0]!.criterionId).toBe("soft-answer-quality");
  });

  it("omits judgeRecords when no judge adapter is configured", async () => {
    const controller = createTerminationController({});
    const contract = contractWith([judgeCriterion({ verifierId: "structured_rubric" })]);
    const verdict = await controller.evaluateTurn({
      contract,
      state: makeState(),
      candidateActions: [],
      llmDoneSignal: false,
    });
    expect(verdict.audit.judgeRecords).toBeUndefined();
  });

  it("the structured_rubric placeholder still works when a judge is present", async () => {
    const controller = createTerminationController({
      judgeLlm: makeJudge({ text: judgeJson(0.9) }),
    });
    const contract = contractWith([
      judgeCriterion({ id: "rubric-crit", verifierId: "structured_rubric" }),
    ]);
    const verdict = await controller.evaluateTurn({
      contract,
      state: makeState({
        trace: {
          conversationTurns: 1,
          plainTextTurns: 1,
          toolCallTurns: 0,
          recentAssistantTexts: [],
          committedOperations: 1,
          rejectedOperations: 0,
        },
      }),
      candidateActions: [],
      llmDoneSignal: false,
    });
    const rubricEval = verdict.audit.criterionEvals.find((e) => e.criterionId === "rubric-crit");
    expect(rubricEval).toBeDefined();
    expect(rubricEval!.rho).toBe(0.3);
    // No judge records for the rubric criterion (it was not routed to llm_judge).
    expect(verdict.audit.judgeRecords ?? []).toHaveLength(0);
  });
});
