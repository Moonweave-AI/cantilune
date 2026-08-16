import type { AcceptanceCriterion, AgentState, CriterionEvaluation, Verifier } from "./types.js";

/**
 * VerifierRegistry — resolves `v_i` by id. The controller never inspects
 * criterion text to pick behavior; it always goes through `evaluate(id, ...)`.
 *
 * Built-in verifiers are deterministic and stateless. P0 ships a small set that
 * directly removes the repeated-reply failure (no_infinite_loop, duplicate_reply)
 * plus generic progress/coverage verifiers. New verifiers are added by
 * `register`, never by branching on instruction text.
 */
export class VerifierRegistry {
  private readonly verifiers = new Map<string, Verifier>();

  constructor(verifiers: readonly Verifier[] = []) {
    for (const verifier of verifiers) this.register(verifier);
  }

  register(verifier: Verifier): void {
    if (this.verifiers.has(verifier.id)) {
      throw new Error(`Verifier "${verifier.id}" is already registered.`);
    }
    this.verifiers.set(verifier.id, verifier);
  }

  has(id: string): boolean {
    return this.verifiers.has(id);
  }

  /**
   * Evaluate one criterion. An unknown verifier fails closed: q=0, ρ=1, passed
   * against a hard gate, so a misconfigured contract cannot silently pass.
   */
  evaluate(id: string, criterion: AcceptanceCriterion, state: AgentState): CriterionEvaluation {
    const verifier = this.verifiers.get(id);
    if (verifier === undefined) {
      return {
        criterionId: criterion.id,
        q: 0,
        rho: 1,
        passed: 0 * 1 >= criterion.threshold,
        evidenceRefs: [],
        rationale: `Unknown verifier "${id}" — failing closed.`,
      };
    }
    return verifier.evaluate(criterion, state);
  }
}

// --- Built-in verifiers -----------------------------------------------------

/** Trims and lowercases for text comparison without any external dependency. */
function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(
    normalize(a)
      .split(/\s+/)
      .filter((w) => w.length > 0),
  );
  const setB = new Set(
    normalize(b)
      .split(/\s+/)
      .filter((w) => w.length > 0),
  );
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / new Set([...setA, ...setB]).size;
}

/**
 * no_infinite_loop (hard): the canonical fix for the repeated-reply failure.
 * Satisfaction `q` falls when the trace shows several recent plain-text turns
 * with no tool calls and no committed coordination progress. The signal is
 * derived purely from the execution trace — no instruction-type assumption.
 */
export const NO_INFINITE_LOOP_VERIFIER: Verifier = {
  id: "no_infinite_loop",
  description:
    "Fails when the agent has emitted multiple plain-text turns with no tool use " +
    "and no coordination progress, i.e. an unproductive loop.",
  evaluate(criterion, state) {
    const trace = state.trace;
    const recent = trace.recentAssistantTexts;
    // Repeat loop signature: >= 3 plain-text turns, zero tool calls, zero commits.
    const looksStuck =
      trace.plainTextTurns >= 3 && trace.toolCallTurns === 0 && trace.committedOperations === 0;
    // Detect near-duplicate consecutive replies — the exact observed symptom.
    const duplicateReply =
      recent.length >= 2 && jaccardSimilarity(recent.at(-1) ?? "", recent.at(-2) ?? "") >= 0.6;

    if (looksStuck || duplicateReply) {
      return {
        criterionId: criterion.id,
        q: 0,
        rho: 1,
        passed: false,
        evidenceRefs: [],
        rationale:
          `Unproductive loop detected: plainTextTurns=${trace.plainTextTurns}, ` +
          `toolCallTurns=${trace.toolCallTurns}, committed=${trace.committedOperations}, ` +
          `duplicateReply=${duplicateReply}.`,
      };
    }
    // A single reply with no looping is acceptable progress for this condition.
    return {
      criterionId: criterion.id,
      q: 1,
      rho: 1,
      passed: true,
      evidenceRefs: [],
      rationale: `No unproductive loop: plainTextTurns=${trace.plainTextTurns}.`,
    };
  },
};

/**
 * duplicate_reply (hard): fails when the pending reply is near-identical to a
 * recent one. Prevents the "self-introduction repeated N times" symptom even
 * before no_infinite_loop accumulates enough turns.
 */
export const DUPLICATE_REPLY_VERIFIER: Verifier = {
  id: "duplicate_reply",
  description: "Fails when the pending reply duplicates a prior reply.",
  evaluate(criterion, state) {
    const reply = state.pendingReply.text;
    if (reply.trim().length === 0) {
      return {
        criterionId: criterion.id,
        q: 0,
        rho: 1,
        passed: false,
        evidenceRefs: [],
        rationale: "Pending reply is empty.",
      };
    }
    const recent = state.trace.recentAssistantTexts.slice(0, -1); // exclude self
    let maxSim = 0;
    let matchedRef = "";
    for (const prev of recent) {
      const sim = jaccardSimilarity(reply, prev);
      if (sim > maxSim) {
        maxSim = sim;
        matchedRef = prev.slice(0, 40);
      }
    }
    const duplicate = maxSim >= 0.6;
    return {
      criterionId: criterion.id,
      q: duplicate ? 0 : 1,
      rho: 1,
      passed: !duplicate,
      evidenceRefs: [],
      rationale: duplicate
        ? `Pending reply duplicates a prior reply (similarity ${maxSim.toFixed(2)}; matched "${matchedRef}…").`
        : `Pending reply is distinct from prior replies (max similarity ${maxSim.toFixed(2)}).`,
    };
  },
};

/**
 * coordination_progress (hard/soft): satisfied when the run has committed at
 * least one coordination operation, indicating the agent acted on the world.
 */
export const COORDINATION_PROGRESS_VERIFIER: Verifier = {
  id: "coordination_progress",
  description: "Satisfied when at least one coordination operation was committed.",
  evaluate(criterion, state) {
    const committed = state.trace.committedOperations;
    const q = committed > 0 ? 1 : 0;
    return {
      criterionId: criterion.id,
      q,
      rho: 1,
      passed: q * 1 >= criterion.threshold,
      evidenceRefs: [],
      rationale:
        committed > 0
          ? `${committed} coordination operation(s) committed.`
          : "No coordination operation committed yet.",
    };
  },
};

/**
 * task_artifact_exists (hard/soft): satisfied when the agent produced at least
 * one artifact or content ref this run.
 */
export const TASK_ARTIFACT_EXISTS_VERIFIER: Verifier = {
  id: "task_artifact_exists",
  description: "Satisfied when at least one artifact/content ref was produced.",
  evaluate(criterion, state) {
    const count = state.artifacts.artifactIds.length + state.artifacts.contentRefs.length;
    const q = count > 0 ? 1 : 0;
    return {
      criterionId: criterion.id,
      q,
      rho: 1,
      passed: q * 1 >= criterion.threshold,
      evidenceRefs: state.artifacts.contentRefs,
      rationale:
        count > 0 ? `${count} artifact(s)/content ref(s) produced.` : "No artifact produced yet.",
    };
  },
};

/**
 * structured_rubric (soft): lowest-priority LLM-judge fallback. P0 ships a
 * deterministic placeholder that scores on reply non-emptiness and trace
 * activity — the LLM judge itself is plugged in by the controller when no
 * harder signal is available, and it may never override a hard failure.
 */
export const STRUCTURED_RUBRIC_VERIFIER: Verifier = {
  id: "structured_rubric",
  description: "Soft rubric fallback when no harder signal covers a criterion.",
  evaluate(criterion, state) {
    const hasReply = state.pendingReply.text.trim().length > 0;
    const hasProgress = state.trace.committedOperations > 0 || state.trace.toolCallTurns > 0;
    const q = (hasReply ? 0.5 : 0) + (hasProgress ? 0.5 : 0);
    return {
      criterionId: criterion.id,
      q,
      rho: 0.3, // low credibility: agent-derived self-assessment tier
      passed: q * 0.3 >= criterion.threshold,
      evidenceRefs: [],
      rationale: `Rubric placeholder: reply=${hasReply}, progress=${hasProgress}.`,
    };
  },
};

/** The default P0 verifier set, registered in every controller. */
export function createDefaultVerifierRegistry(): VerifierRegistry {
  return new VerifierRegistry([
    NO_INFINITE_LOOP_VERIFIER,
    DUPLICATE_REPLY_VERIFIER,
    COORDINATION_PROGRESS_VERIFIER,
    TASK_ARTIFACT_EXISTS_VERIFIER,
    STRUCTURED_RUBRIC_VERIFIER,
  ]);
}
