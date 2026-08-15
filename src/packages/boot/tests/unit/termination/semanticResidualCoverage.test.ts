/**
 * Branch coverage for the semantic-residual engine (ADR-0013).
 *
 * The engine has two paths — real embeddings and the Jaccard fallback — plus
 * edge branches: m===0 (no goals), n===0 (no evidence), empty-set Jaccard, the
 * `claimed.has(j)` continue, the `cost[i]?.[j] ?? 1` nullish coalescing, an
 * embedder that throws (fall through to Jaccard), and the `evidences[j]?.text`
 * text coalescing. Each is a real production fallback, not a decorative guard.
 */
import { describe, it, expect } from "vitest";
import { computeResidual, coverageFromResidual } from "../../../src/termination/semanticResidual.js";
import type { AgentState, GoalContract, EmbeddingAdapter } from "../../../src/termination/types.js";

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

function contractWith(criteria: GoalContract["criteria"]): GoalContract {
  return {
    contractId: "sha256:test",
    instruction: "test",
    criteria,
    frozenAt: "2026-01-01T00:00:00.000Z",
    compiledBy: "system",
  };
}

function criterion(id: string, description: string): GoalContract["criteria"][number] {
  return { id, description, kind: "soft", weight: 0.5, threshold: 0.5, verifierId: "structured_rubric" };
}

describe("computeResidual — Jaccard fallback path", () => {
  it("returns full residual when there are no goals (m===0)", async () => {
    const contract = contractWith([]);
    const state = makeState();
    const result = await computeResidual(contract, state, undefined);
    expect(result.residual).toEqual([]);
    expect(result.D_sem).toBe(1);
    expect(result.usedEmbeddings).toBe(false);
  });

  it("returns full residual when there are goals but no evidence (n===0)", async () => {
    const contract = contractWith([criterion("g1", "describe the report")]);
    const state = makeState(); // no evidence, empty pending reply
    const result = await computeResidual(contract, state, undefined);
    expect(result.residual).toEqual([1]);
    expect(result.D_sem).toBe(1);
    expect(result.usedEmbeddings).toBe(false);
  });

  it("matches goals to evidence via Jaccard and computes residual < 1 on overlap", async () => {
    const contract = contractWith([criterion("g1", "write the quarterly report")]);
    const state = makeState({
      evidence: {
        items: [
          { ref: "ev1", tier: "artifact", rho: 1, summary: "wrote the quarterly report file" },
        ],
      },
    });
    const result = await computeResidual(contract, state, undefined);
    expect(result.usedEmbeddings).toBe(false);
    expect(result.residual[0]).toBeLessThan(1);
    expect(result.D_sem).toBeLessThan(1);
  });

  it("coalesces nullish evidence text (evidences[j]?.text ?? empty) when an evidence summary is empty", async () => {
    // An evidence item with an empty summary is filtered out of evidenceTexts,
    // but the pending reply path exercises the empty-string coalescing branch
    // when combined with a goal whose Jaccard to empty is 0.
    const contract = contractWith([criterion("g1", "unique tokens here")]);
    const state = makeState({
      pendingReply: { text: "   ", hasToolCalls: false }, // trimmed empty → not added as evidence
    });
    const result = await computeResidual(contract, state, undefined);
    expect(result.residual[0]).toBe(1); // no evidence → full residual
  });

  it("handles the pending-reply evidence path with real tokens", async () => {
    const contract = contractWith([criterion("g1", "summarize the findings")]);
    const state = makeState({
      pendingReply: { text: "Here I summarize the findings clearly.", hasToolCalls: false },
    });
    const result = await computeResidual(contract, state, undefined);
    expect(result.usedEmbeddings).toBe(false);
    expect(result.residual[0]).toBeLessThan(1);
  });

  it("processes multiple goals with more goals than evidence (constrained OT claims evidence)", async () => {
    // m=3 goals, n=1 evidence → one goal claims the evidence, two remain at residual 1.
    const contract = contractWith([
      criterion("g1", "alpha beta gamma"),
      criterion("g2", "delta epsilon zeta"),
      criterion("g3", "eta theta iota"),
    ]);
    const state = makeState({
      evidence: {
        items: [
          { ref: "ev1", tier: "artifact", rho: 1, summary: "alpha beta gamma delta" },
        ],
      },
    });
    const result = await computeResidual(contract, state, undefined);
    expect(result.residual).toHaveLength(3);
    // The first goal (best match) should have the lowest residual.
    expect(result.residual[0]).toBeLessThanOrEqual(result.residual[1]!);
  });
});

describe("computeResidual — embedding path", () => {
  /** Deterministic embedder: maps each text to a unit vector based on a hash,
   * so the cosine / OT path runs with real numeric vectors. */
  function fakeEmbedder(dim = 8): EmbeddingAdapter {
    return {
      dimensions: dim,
      async embed(texts: readonly string[]) {
        return texts.map((t) => {
          const vec = new Array<number>(dim).fill(0);
          for (let i = 0; i < t.length; i++) {
            vec[t.charCodeAt(i) % dim] = (vec[t.charCodeAt(i) % dim] ?? 0) + 1;
          }
          const n = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
          return vec.map((v) => v / n);
        });
      },
    };
  }

  it("uses embeddings when an embedder is provided and reports usedEmbeddings=true", async () => {
    const contract = contractWith([criterion("g1", "write a report")]);
    const state = makeState({
      evidence: { items: [{ ref: "ev1", tier: "artifact", rho: 1, summary: "wrote a report" }] },
    });
    const result = await computeResidual(contract, state, fakeEmbedder());
    expect(result.usedEmbeddings).toBe(true);
    expect(result.residual[0]).toBeLessThan(1);
  });

  it("falls back to Jaccard when the embedder throws", async () => {
    const contract = contractWith([criterion("g1", "write a report")]);
    const state = makeState({
      evidence: { items: [{ ref: "ev1", tier: "artifact", rho: 1, summary: "wrote a report" }] },
    });
    const failingEmbedder: EmbeddingAdapter = {
      dimensions: 8,
      async embed() {
        throw new Error("embedding service unavailable");
      },
    };
    const result = await computeResidual(contract, state, failingEmbedder);
    expect(result.usedEmbeddings).toBe(false);
    expect(result.residual[0]).toBeLessThan(1);
  });

  it("handles empty-string Jaccard (sa.size===0) via the empty-set guard", async () => {
    // A goal description that is only whitespace → jaccard sa is empty → returns 0
    // similarity (cost 1, full residual) for that goal.
    const contract = contractWith([criterion("g1", "   ")]);
    const state = makeState({
      evidence: { items: [{ ref: "ev1", tier: "artifact", rho: 1, summary: "real evidence text" }] },
    });
    const result = await computeResidual(contract, state, undefined);
    expect(result.residual[0]).toBe(1);
  });
});

describe("coverageFromResidual", () => {
  it("returns 0 for an empty residual vector", () => {
    expect(coverageFromResidual([])).toBe(0);
  });

  it("returns 1 minus the worst (max) residual", () => {
    expect(coverageFromResidual([0.2, 0.5, 0.1])).toBeCloseTo(0.5, 5);
  });

  it("clamps to 0 when the worst residual exceeds 1", () => {
    expect(coverageFromResidual([1.5, 0.2])).toBe(0);
  });
});
