import type { EmbeddingAdapter, GoalContract, AgentState } from "./types.js";

/**
 * SemanticResidualEngine — for open-text criteria ("argument covers X") that
 * cannot be written as a precise assertion, embedding similarity is used only as
 * a semantic sensor, never a dictator.
 *
 * Rather than `cos(Embed(goal), Embed(reply))` — which rewards goal-paraphrasing
 * filler — the engine solves a constrained optimal-transport match between goal
 * criteria and evidence/artifact texts. Each goal must match real evidence; one
 * generic text cannot match every goal; unmatched goals contribute residual.
 *
 * Zero-training: no learned value function. The OT solve is a greedy constrained
 * match (m, n are small). With no embedder, it degrades to a Jaccard fallback.
 */

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

function norm(a: readonly number[]): number {
  return Math.sqrt(dot(a, a)) || 1;
}

function cosine(a: readonly number[], b: readonly number[]): number {
  return dot(a, b) / (norm(a) * norm(b));
}

/** Token Jaccard fallback for when no embedding adapter is available. */
function jaccard(a: string, b: string): number {
  const sa = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0),
  );
  const sb = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0),
  );
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / new Set([...sa, ...sb]).size;
}

/** Evidence texts the engine matches goals against. */
function evidenceTexts(state: AgentState): { text: string; ref: string }[] {
  const texts: { text: string; ref: string }[] = [];
  for (const e of state.evidence.items) {
    if (e.summary.length > 0) texts.push({ text: e.summary, ref: e.ref });
  }
  // Include the pending reply once, with capped capacity so agent self-report
  // cannot match every goal.
  if (state.pendingReply.text.trim().length > 0) {
    texts.push({ text: state.pendingReply.text, ref: "pending_reply" });
  }
  return texts;
}

/**
 * Greedy constrained OT: for each goal, pick the best-matching evidence not yet
 * claimed by a higher-scoring goal. Residual per goal = 1 - best_match (0 if no
 * evidence matched). Returns the residual vector `r_t` and mean distance `D_sem`.
 */
function constrainedMatch(
  cost: number[][],
  m: number,
  n: number,
): {
  residual: number[];
  totalCost: number;
} {
  const residual = new Array<number>(m).fill(1);
  if (m === 0) return { residual, totalCost: 0 };
  const claimed = new Set<number>();
  let totalCost = 0;
  // Process goals in order; each takes its best unclaimed evidence.
  for (let i = 0; i < m; i++) {
    let best = Infinity;
    let bestJ = -1;
    for (let j = 0; j < n; j++) {
      if (claimed.has(j)) continue;
      const c = cost[i]?.[j] ?? 1;
      if (c < best) {
        best = c;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      claimed.add(bestJ);
      residual[i] = best; // cost = 1 - similarity ∈ [0,1]
      totalCost += best;
    }
  }
  return { residual, totalCost };
}

export interface SemanticResidualResult {
  /** Per-criterion residual `r_t ∈ [0,1]`. */
  readonly residual: readonly number[];
  /** Mean transport distance `D_sem`. */
  readonly D_sem: number;
  /** Whether real embeddings were used (false => Jaccard fallback). */
  readonly usedEmbeddings: boolean;
}

/**
 * Compute the semantic residual for the contract against the current state.
 * With no embedder, falls back to Jaccard similarity. Never throws.
 */
export async function computeResidual(
  contract: GoalContract,
  state: AgentState,
  embedder: EmbeddingAdapter | undefined,
): Promise<SemanticResidualResult> {
  const goals = contract.criteria.map((c) => c.description);
  const evidences = evidenceTexts(state);
  const m = goals.length;
  const n = evidences.length;

  if (m === 0 || n === 0) {
    return { residual: new Array<number>(m).fill(1), D_sem: 1, usedEmbeddings: false };
  }

  if (embedder !== undefined) {
    try {
      const goalVecs = await embedder.embed(goals);
      const evidenceVecs = await embedder.embed(evidences.map((e) => e.text));
      const cost: number[][] = [];
      for (let i = 0; i < m; i++) {
        const row: number[] = [];
        for (let j = 0; j < n; j++) {
          const sim = cosine(goalVecs[i] ?? [], evidenceVecs[j] ?? []);
          row.push(1 - Math.max(0, sim));
        }
        cost.push(row);
      }
      const { residual, totalCost } = constrainedMatch(cost, m, n);
      return {
        residual,
        D_sem: totalCost / m,
        usedEmbeddings: true,
      };
    } catch {
      // Fall through to Jaccard fallback.
    }
  }

  // Jaccard fallback: zero-training, no network.
  const cost: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(1 - jaccard(goals[i] ?? "", evidences[j]?.text ?? ""));
    }
    cost.push(row);
  }
  const { residual, totalCost } = constrainedMatch(cost, m, n);
  return { residual, D_sem: totalCost / m, usedEmbeddings: false };
}

/**
 * semantic_coverage verifier helper: satisfaction from residual. Lower residual
 * means higher coverage. `q = 1 - max_residual` (the worst-covered goal gates).
 */
export function coverageFromResidual(residual: readonly number[]): number {
  if (residual.length === 0) return 0;
  const worst = Math.max(...residual);
  return Math.max(0, 1 - worst);
}
