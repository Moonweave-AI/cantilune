import type {
  CandidateAction,
  CriterionEvaluation,
  GoalContract,
  ValueOfContinuation,
  ControllerThresholds,
} from "./types.js";

/**
 * ValueOfContinuationEstimator — estimates `VOC_t(a) = ΔC_t(a) − λ·Cost − μ·Risk`
 * for each candidate action, and returns `VOC*_t = max_a VOC_t(a)`.
 *
 * `ΔC_t(a) = Σ_i w_i (1 − q_i) rel(a, c_i) p_succ(a, i)` — the expected completion
 * gain from action a. P0 uses static `rel` heuristics and a fixed/estimated
 * success probability. Zero-training: no learned value function.
 */

/** Static relevance of an action kind to a criterion verifier id. P0 heuristic. */
function relevance(action: CandidateAction, verifierId: string): number {
  // Coordination actions can progress coordination/artifact criteria.
  if (verifierId === "coordination_progress") {
    return action.kind === "coordination" ? 0.9 : 0.1;
  }
  if (verifierId === "task_artifact_exists") {
    return action.kind === "coordination" || action.kind === "tool" ? 0.8 : 0.2;
  }
  // duplicate_reply / no_infinite_loop are fixed by NOT repeating — an explicit
  // text turn that is distinct has low but nonzero relevance.
  if (verifierId === "duplicate_reply" || verifierId === "no_infinite_loop") {
    return action.kind === "text" ? 0.3 : 0.2;
  }
  // semantic_coverage improves as new evidence/artifacts appear.
  if (verifierId === "semantic_coverage") {
    return action.kind === "tool" || action.kind === "coordination" ? 0.7 : 0.2;
  }
  // structured_rubric: generic.
  return 0.3;
}

/** Estimated success probability by action kind. P0 fixed defaults. */
function successProbability(action: CandidateAction): number {
  switch (action.kind) {
    case "coordination":
      return 0.85;
    case "tool":
      return 0.7;
    case "text":
      return 1; // emitting text always "succeeds" as an operation
  }
}

/** Cost of an action by kind. P0 fixed units. */
function actionCost(action: CandidateAction): number {
  switch (action.kind) {
    case "coordination":
      return 1;
    case "tool":
      return 1.5;
    case "text":
      return 0.5;
  }
}

/** Risk of an action by kind. P0 fixed units. */
function actionRisk(action: CandidateAction): number {
  switch (action.kind) {
    case "coordination":
      return 0.2;
    case "tool":
      return 0.4;
    case "text":
      return 0.1;
  }
}

/**
 * Estimate VOC across candidate actions given current per-criterion evaluations.
 *
 * @param contract The frozen goal contract (for weights w_i and verifier ids).
 * @param evaluations Current per-criterion evaluations (for q_i).
 * @param actions Candidate actions the agent could take next.
 * @param thresholds VOC coefficients λ, μ.
 */
export function estimateVOC(
  contract: GoalContract,
  evaluations: readonly CriterionEvaluation[],
  actions: readonly CandidateAction[],
  thresholds: ControllerThresholds,
): ValueOfContinuation {
  const evalById = new Map(evaluations.map((e) => [e.criterionId, e]));
  const perAction = new Map<string, number>();

  let star = -Infinity;
  let bestAction: string | undefined;

  if (actions.length === 0) {
    return { perAction, star: 0, bestAction: undefined };
  }

  for (const action of actions) {
    let deltaC = 0;
    for (const criterion of contract.criteria) {
      const eval_ = evalById.get(criterion.id);
      const q = eval_?.q ?? 0;
      const rel = relevance(action, criterion.verifierId);
      const pSucc = successProbability(action);
      deltaC += criterion.weight * (1 - q) * rel * pSucc;
    }
    const cost = actionCost(action);
    const risk = actionRisk(action);
    const voc = deltaC - thresholds.lambda * cost - thresholds.mu * risk;
    perAction.set(action.name, voc);
    if (voc > star) {
      star = voc;
      bestAction = action.name;
    }
  }

  if (!Number.isFinite(star)) star = 0;
  return { perAction, star, bestAction };
}
