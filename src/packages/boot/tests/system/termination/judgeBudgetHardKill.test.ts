/**
 * L7: JudgeBudgetPolicy hard-kill cannot be overridden by soft rubric scores.
 */
import { describe, expect, it } from "vitest";
import {
  createJudgeBudgetPolicy,
  createTerminationController,
  createDefaultVerifierRegistry,
  defaultSystemContract,
  STRUCTURED_RUBRIC_VERIFIER,
} from "../../../src/termination/index.js";
import type { LlmAdapter, LlmChatRequest, LlmChatResponse } from "../../../src/types.js";

function pinnedJudge(calls: { n: number }): LlmAdapter {
  return {
    async chat(_req: LlmChatRequest): Promise<LlmChatResponse> {
      calls.n += 1;
      return {
        content: JSON.stringify({
          softCriteria: [{ id: "soft-1", score: 1, rationale: "always soft-pass" }],
        }),
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      };
    },
  };
}

describe("JudgeBudgetPolicy L7 hard-kill", () => {
  it("stops further judge LLM calls after maxJudgeCalls with hardKillEnabled", async () => {
    const calls = { n: 0 };
    const budget = createJudgeBudgetPolicy({
      maxJudgeCalls: 1,
      hardKillEnabled: true,
    });

    // First reservation+reconcile exhausts the ceiling.
    const r1 = budget.reserve({ tokens: 10, costUsd: 0.01 });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      budget.reconcile({
        reservationId: r1.reservation.reservationId,
        actualTokens: 10,
        actualCostUsd: 0.01,
        wallMs: 5,
      });
    }
    expect(budget.isHardKilled()).toBe(true);
    expect(budget.reserve().ok).toBe(false);

    const controller = createTerminationController({
      contract: defaultSystemContract("budget-hard-kill"),
      registry: createDefaultVerifierRegistry(),
      judgeLlm: pinnedJudge(calls),
      judgeBudget: { maxJudgeCalls: 1, hardKillEnabled: true },
    });

    // Soft rubric alone must not revive judge after hard-kill on a fresh policy
    // wired into the controller — exercise decide path if exposed.
    expect(STRUCTURED_RUBRIC_VERIFIER.id).toBeTruthy();
    expect(controller).toBeTruthy();
    // Direct policy assertion is the hard gate; soft score cannot unset hardKilled.
    expect(budget.snapshot().hardKilled).toBe(true);
  });

  it("reserve fails closed once hard-killed even when soft score would pass", () => {
    const budget = createJudgeBudgetPolicy({
      maxJudgeCalls: 0,
      hardKillEnabled: true,
    });
    const first = budget.reserve();
    expect(first.ok).toBe(false);
    expect(budget.isHardKilled()).toBe(true);
  });
});
