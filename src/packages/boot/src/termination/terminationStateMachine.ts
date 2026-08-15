import type {
  ControlVerdict,
  ControllerThresholds,
  CriterionEvaluation,
  GoalContract,
  TerminationAudit,
  ValueOfContinuation,
} from "./types.js";

/**
 * TerminationStateMachine — the only authority on termination.
 *
 * Decides via lexicographic precedence, never an opaque total score:
 *   hard constraints > verifiable state > math metrics > vector residual > LLM judge
 *
 * The LLM's `done` signal is an input hint: it may request completion, but the
 * state machine confirms it with evidence. A "looks done but no evidence" state
 * yields VERIFY, not DONE.
 *
 * Hard rule: no instruction-type preset. Every instruction walks the same path.
 */

function hardGateFromContract(
  contract: GoalContract,
  evaluations: readonly CriterionEvaluation[],
): number {
  const hard = contract.criteria.filter((c) => c.kind === "hard");
  if (hard.length === 0) return 1; // no hard conditions => gate trivially open
  return hard.every((c) => evaluations.find((e) => e.criterionId === c.id)?.passed)
    ? 1
    : 0;
}

/**
 * Weighted completion C and uncertainty U.
 *
 * C measures *satisfaction* only — the verifier's q score for each criterion,
 * weighted by w_i. It does NOT fold in evidence credibility ρ.
 * U measures the *evidence gap* — 1-ρ_i, weighted by w_i.
 *
 * C and U are deliberately decoupled so the "looks satisfied but under-evidenced"
 * state — high C and high U together — is reachable and routes to VERIFY rather
 * than DONE. Folding ρ into C (Σwqρ/Σw) made C+U=1 whenever q=1, which made
 * C≥τ_C ∧ U>τ_U unreachable and VERIFY dead code. Do not couple them.
 *
 * DONE still cannot fire on low-evidence satisfaction: DONE requires U<=τ_U,
 * so a fully-satisfied-but-under-evidenced state (C high, U high) is forced to
 * VERIFY first, and only reaches DONE once evidence credibility clears τ_U.
 */
function weightedCompletion(
  contract: GoalContract,
  evaluations: readonly CriterionEvaluation[],
): { C: number; U: number } {
  let weightSum = 0;
  let weightedSatisfaction = 0;
  let weightedRhoGap = 0;
  for (const criterion of contract.criteria) {
    const eval_ = evaluations.find((e) => e.criterionId === criterion.id);
    const q = eval_?.q ?? 0;
    const rho = eval_?.rho ?? 0;
    const w = criterion.weight;
    weightSum += w;
    weightedSatisfaction += w * q;
    weightedRhoGap += w * (1 - rho);
  }
  const C = weightSum > 0 ? weightedSatisfaction / weightSum : 0;
  const U = weightSum > 0 ? weightedRhoGap / weightSum : 0;
  return { C, U };
}

function buildAudit(
  contract: GoalContract,
  evaluations: readonly CriterionEvaluation[],
  voc: ValueOfContinuation,
  residual: readonly number[],
  decisionChain: readonly string[],
): TerminationAudit {
  const H = hardGateFromContract(contract, evaluations);
  const { C, U } = weightedCompletion(contract, evaluations);
  return {
    H,
    C,
    U,
    VOC_star: voc.star,
    residual,
    criterionEvals: evaluations,
    decisionChain,
  };
}

/**
 * The core decision. Pure function of (contract, evaluations, VOC, residual,
 * thresholds, llmDoneSignal). Returns one of six verdicts with an audit trail.
 *
 * Precedence is lexicographic and evaluated in order; each `tryX` helper returns
 * the verdict when its condition holds, or `undefined` to defer to the next. The
 * math is unchanged from the single-function form — this split only isolates
 * each precedence level for readability.
 */
interface DecisionContext {
  readonly contract: GoalContract;
  readonly evaluations: readonly CriterionEvaluation[];
  readonly voc: ValueOfContinuation;
  readonly residual: readonly number[];
  readonly thresholds: ControllerThresholds;
  readonly H: number;
  readonly C: number;
  readonly U: number;
  readonly VOC_star: number;
}

/** 1. DONE: H=1 ∧ C>=τ_C ∧ U<=τ_U ∧ VOC*<=ε */
function tryDone(ctx: DecisionContext, chain: string[]): ControlVerdict | undefined {
  const { H, C, U, VOC_star, thresholds } = ctx;
  if (H >= thresholds.hardGate && C >= thresholds.tauC && U <= thresholds.tauU) {
    if (VOC_star <= thresholds.epsilon) {
      chain.push("→ DONE: hard gate open, completion met, uncertainty low, no worthwhile action.");
      return { kind: "DONE", audit: buildAudit(ctx.contract, ctx.evaluations, ctx.voc, ctx.residual, chain) };
    }
    chain.push("→ not DONE: worthwhile continuation action remains (VOC* > ε).");
  } else {
    if (H < thresholds.hardGate) chain.push("→ not DONE: hard gate closed.");
    if (C < thresholds.tauC) chain.push("→ not DONE: completion below τ_C.");
    if (U > thresholds.tauU) chain.push("→ not DONE: uncertainty above τ_U.");
  }
  return undefined;
}

/** 2. VERIFY: C>=τ_C ∧ U>τ_U — looks complete but evidence insufficient. */
function tryVerify(ctx: DecisionContext, chain: string[]): ControlVerdict | undefined {
  const { C, U, thresholds, evaluations } = ctx;
  if (!(C >= thresholds.tauC && U > thresholds.tauU)) return undefined;
  const missing = evaluations
    .filter((e) => e.rho < 1)
    .map((e) => `low-evidence criterion ${e.criterionId} (ρ=${e.rho.toFixed(2)})`);
  chain.push("→ VERIFY: completion reached but evidence credibility too low.");
  return {
    kind: "VERIFY",
    audit: buildAudit(ctx.contract, ctx.evaluations, ctx.voc, ctx.residual, chain),
    missingEvidence: missing.length > 0 ? missing : ["unspecified evidence gap"],
  };
}

/**
 * 3. ASK_USER: unmet residual depends on user-only knowledge (preferences,
 * scope, permission, info not inferable from environment). P0 heuristic:
 * completion is low, no committed progress, no worthwhile action, but a
 * reply exists awaiting clarification.
 */
function tryAskUser(ctx: DecisionContext, chain: string[]): ControlVerdict | undefined {
  const { C, VOC_star, thresholds, evaluations } = ctx;
  const hasProgress = evaluations.some((e) => e.passed && e.rho >= 0.5);
  if (!(C < thresholds.tauC && VOC_star <= thresholds.epsilon && !hasProgress)) return undefined;
  // Distinguish REPLAN/STALLED from ASK_USER: if there is a candidate action
  // with positive VOC we already covered CONTINUE. Here VOC*<=ε so no action
  // helps — ask the user rather than silently looping.
  chain.push("→ ASK_USER: no progress and no worthwhile action; user input needed.");
  return {
    kind: "ASK_USER",
    audit: buildAudit(ctx.contract, ctx.evaluations, ctx.voc, ctx.residual, chain),
    question:
      "I cannot make further progress without more information. What would you like me to do next?",
  };
}

/** 4. CONTINUE: VOC* > ε — a worthwhile action exists. */
function tryContinue(ctx: DecisionContext, chain: string[]): ControlVerdict | undefined {
  const { VOC_star, thresholds, voc } = ctx;
  if (!(VOC_star > thresholds.epsilon)) return undefined;
  chain.push("→ CONTINUE: a worthwhile continuation action exists.");
  const verdict: ControlVerdict = {
    kind: "CONTINUE",
    audit: buildAudit(ctx.contract, ctx.evaluations, ctx.voc, ctx.residual, chain),
  };
  if (voc.bestAction !== undefined) {
    (verdict as { recommendedAction?: string }).recommendedAction = voc.bestAction;
  }
  return verdict;
}

/**
 * 5. REPLAN vs STALLED: completion low, ΔC≈0 (VOC*<=ε). REPLAN if some action
 * has any positive VOC; STALLED if none.
 */
function replanOrStalled(ctx: DecisionContext, chain: string[]): ControlVerdict {
  const anyPositive = [...ctx.voc.perAction.values()].some((v) => v > 0);
  if (anyPositive) {
    chain.push("→ REPLAN: current direction stalled but an alternative shows promise.");
    return {
      kind: "REPLAN",
      audit: buildAudit(ctx.contract, ctx.evaluations, ctx.voc, ctx.residual, chain),
      reason: "Current approach lacks progress; reconsider the plan.",
    };
  }
  chain.push("→ STALLED: no completion and no worthwhile continuation path.");
  return {
    kind: "STALLED",
    audit: buildAudit(ctx.contract, ctx.evaluations, ctx.voc, ctx.residual, chain),
    blocker: "No candidate action yields positive value; goal cannot progress.",
  };
}

export function decide(input: {
  readonly contract: GoalContract;
  readonly evaluations: readonly CriterionEvaluation[];
  readonly voc: ValueOfContinuation;
  readonly residual: readonly number[];
  readonly thresholds: ControllerThresholds;
  readonly llmDoneSignal: boolean;
}): ControlVerdict {
  const { contract, evaluations, voc, residual, thresholds, llmDoneSignal } = input;
  const chain: string[] = [];
  const H = hardGateFromContract(contract, evaluations);
  const { C, U } = weightedCompletion(contract, evaluations);
  const VOC_star = voc.star;

  chain.push(`H=${H} (hard gate)`);
  chain.push(`C=${C.toFixed(3)} (completion)`);
  chain.push(`U=${U.toFixed(3)} (uncertainty)`);
  chain.push(`VOC*=${VOC_star.toFixed(3)} (value of continuation)`);
  if (llmDoneSignal) chain.push("LLM signaled done (advisory only)");

  const ctx: DecisionContext = {
    contract,
    evaluations,
    voc,
    residual,
    thresholds,
    H,
    C,
    U,
    VOC_star,
  };

  return (
    tryDone(ctx, chain) ??
    tryVerify(ctx, chain) ??
    tryAskUser(ctx, chain) ??
    tryContinue(ctx, chain) ??
    replanOrStalled(ctx, chain)
  );
}
