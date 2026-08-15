/**
 * Core types for the zero-training, math-first termination controller.
 *
 * The controller replaces LLM-owned termination. The LLM proposes actions and
 * drafts the goal contract; a deterministic state machine — operating on the
 * full agent state, not just the reply — owns every termination decision and
 * emits an auditable rationale for each one.
 *
 * Design constraint (hard rule): no instruction-type preset. There is exactly
 * one control path for every instruction. A "hello" stopping after one reply
 * is the natural product of generic conditions (no-infinite-loop satisfied,
 * VOC <= ε, U <= τ_U) yielding DONE — never a special-cased "chat mode".
 */

/** SHA-256 ContentRef string, re-declared locally to keep this module decoupled from core branding. */
export type RefString = string;

/**
 * A frozen structured acceptance contract compiled once at the start of a run.
 *
 * The LLM may draft the criteria, but the system freezes them into an immutable
 * structure so the model cannot silently redefine "done" mid-run.
 */
export interface GoalContract {
  /** Stable digest of the canonical frozen content. */
  readonly contractId: string;
  /** Original user instruction, preserved verbatim for verifiers. */
  readonly instruction: string;
  readonly criteria: readonly AcceptanceCriterion[];
  /** ISO timestamp the contract was frozen. */
  readonly frozenAt: string;
  /** Who drafted the criteria before freezing. */
  readonly compiledBy: "llm" | "system";
}

/**
 * One acceptance condition `c_i` of the goal contract.
 *
 * `G = { (c_i, w_i, τ_i, k_i, v_i) }` — condition, weight, threshold, hardness,
 * verifier reference.
 */
export interface AcceptanceCriterion {
  readonly id: string;
  readonly description: string;
  /** Hard conditions gate DONE; soft conditions contribute to C_t. */
  readonly kind: "hard" | "soft";
  /** Weight `w_i` for soft-condition aggregation. Hard conditions use weight 1. */
  readonly weight: number;
  /** Pass threshold `τ_i ∈ [0,1]`. A condition passes when `q * ρ >= τ`. */
  readonly threshold: number;
  /** Verifier id `v_i` resolved by the VerifierRegistry. */
  readonly verifierId: string;
}

/**
 * The object of evaluation is the complete state, never the reply alone.
 *
 * `x_t = (S_t, A_t, E_t, T_≤t, R_t)` — environment, artifacts, evidence, trace,
 * and the pending reply. Evaluating only the reply lets a model fake completion
 * with goal-paraphrasing prose.
 */
export interface AgentState {
  /** `S_t`: coordination world snapshot (participants, artifacts, audit tail). */
  readonly environment: EnvironmentState;
  /** `A_t`: produced artifacts — artifact entries plus content refs written this run. */
  readonly artifacts: ArtifactSet;
  /** `E_t`: evidence with tiered trust. */
  readonly evidence: EvidenceSet;
  /** `T_≤t`: full execution trace — conversation messages plus runtime change history. */
  readonly trace: ExecutionTrace;
  /** `R_t`: the reply the agent is about to send to the user. */
  readonly pendingReply: PendingReply;
}

/** `S_t` — projection of the coordination world for verifiers. */
export interface EnvironmentState {
  readonly worldSummary: string;
  readonly headRef: RefString | undefined;
  readonly epochId: string | undefined;
  readonly participantCount: number;
  readonly artifactCount: number;
  readonly auditTailLength: number;
}

/** `A_t` — artifacts produced during the run. */
export interface ArtifactSet {
  readonly artifactIds: readonly string[];
  readonly contentRefs: readonly RefString[];
}

/** Evidence tier — fixed trust priority, highest to lowest. */
export type EvidenceTier = "environment" | "tool" | "artifact" | "user" | "agent_self";

/**
 * `E_t` — a piece of evidence with its trust tier and a derived credibility `ρ`.
 *
 * Priority is fixed: environment/test > tool return > checkable artifact >
 * user confirmation > agent self-report. Agent self-report capacity is capped so
 * "looks done but no evidence" surfaces as high C with high U → VERIFY, not DONE.
 */
export interface Evidence {
  readonly ref: RefString;
  readonly tier: EvidenceTier;
  /** Credibility `ρ ∈ [0,1]`, derived from tier plus optional verifier override. */
  readonly rho: number;
  readonly summary: string;
}

export interface EvidenceSet {
  readonly items: readonly Evidence[];
}

/** `T_≤t` — execution trace for progress/no-progress detection. */
export interface ExecutionTrace {
  readonly conversationTurns: number;
  readonly plainTextTurns: number;
  readonly toolCallTurns: number;
  readonly recentAssistantTexts: readonly string[];
  readonly committedOperations: number;
  readonly rejectedOperations: number;
}

/** `R_t` — the reply being prepared. */
export interface PendingReply {
  readonly text: string;
  readonly hasToolCalls: boolean;
}

/**
 * A single criterion evaluation `q_i,t = v_i(c_i, x_t)` plus credibility `ρ_i,t`.
 */
export interface CriterionEvaluation {
  readonly criterionId: string;
  /** Satisfaction `q ∈ [0,1]`. */
  readonly q: number;
  /** Evidence credibility `ρ ∈ [0,1]`. */
  readonly rho: number;
  /** `q * ρ >= threshold`. */
  readonly passed: boolean;
  readonly evidenceRefs: readonly RefString[];
  readonly rationale: string;
}

/**
 * The six controller verdicts. Only DONE / STALLED are terminal; ASK_USER pauses;
 * CONTINUE / VERIFY / REPLAN continue the loop with different steering.
 */
export type ControlVerdict =
  | { readonly kind: "DONE"; readonly audit: TerminationAudit }
  | {
      readonly kind: "CONTINUE";
      readonly audit: TerminationAudit;
      readonly recommendedAction?: string;
    }
  | {
      readonly kind: "VERIFY";
      readonly audit: TerminationAudit;
      readonly missingEvidence: readonly string[];
    }
  | {
      readonly kind: "ASK_USER";
      readonly audit: TerminationAudit;
      readonly question: string;
      readonly options?: readonly string[];
    }
  | { readonly kind: "REPLAN"; readonly audit: TerminationAudit; readonly reason: string }
  | { readonly kind: "STALLED"; readonly audit: TerminationAudit; readonly blocker: string };

/**
 * Auditable termination accounting. Every verdict carries one so a caller can
 * inspect exactly why the controller decided — never an opaque total score.
 */
export interface TerminationAudit {
  /** Hard-condition gate `H_t ∈ {0,1}` — 1 iff every hard condition passes. */
  readonly H: number;
  /** Overall completion `C_t ∈ [0,1]`. */
  readonly C: number;
  /** Uncertainty `U_t ∈ [0,1]` — low evidence trust. */
  readonly U: number;
  /** Maximum value of continuation `VOC*_t`. */
  readonly VOC_star: number;
  /** Semantic residual vector `r_t` — unmet-goal coverage per criterion. */
  readonly residual: readonly number[];
  readonly criterionEvals: readonly CriterionEvaluation[];
  /** Lexicographic decision trail: each step that ruled a verdict in or out. */
  readonly decisionChain: readonly string[];
  /**
   * Per-criterion LLM judge call records (ADR-0020), present only when a judge
   * adapter is configured. Sanitized, append-only: no raw secrets cross the
   * journal boundary. Absent when no judge ran this turn.
   */
  readonly judgeRecords?: readonly JudgeCallRecord[];
}

/**
 * One LLM judge invocation record (ADR-0020 §6). Sanitized for the append-only
 * audit journal: only digests and model ids, never raw prompts or secrets.
 */
export interface JudgeCallRecord {
  readonly criterionId: string;
  /** sha256 of the blinded prompt — reproducible, not reversible to secrets. */
  readonly promptDigest: string;
  /** Adapter model id (provider-supplied), for cost/replay attribution. */
  readonly modelId: string;
  /** Pinned replay seed (derived from contract digest) injected into the prompt. */
  readonly seed: string;
  /** Raw judge `q` before clamping to `[0,1]`; `undefined` if unparseable. */
  readonly rawQ: number | undefined;
  /** Raw judge rationale; `undefined` if unparseable. */
  readonly rawRationale: string | undefined;
  /** Whether `rawQ` was outside `[0,1]` and clamped. */
  readonly clamped: boolean;
  /** Whether the call failed and the verifier fell back to the placeholder. */
  readonly fellBack: boolean;
}

/** Thresholds and VOC coefficients. Fixed defaults, centrally configurable. */
export interface ControllerThresholds {
  /** `τ_C` — minimum overall completion for DONE/VERIFY. */
  readonly tauC: number;
  /** `τ_U` — maximum uncertainty for DONE. */
  readonly tauU: number;
  /** `ε` — a continuation action is worth taking only if VOC > ε. */
  readonly epsilon: number;
  /** `λ` — cost coefficient in `VOC = ΔC − λ·Cost − μ·Risk`. */
  readonly lambda: number;
  /** `μ` — risk coefficient. */
  readonly mu: number;
  /** Hard gate product threshold (always 1: every hard condition must pass). */
  readonly hardGate: number;
}

export const DEFAULT_THRESHOLDS: ControllerThresholds = Object.freeze({
  tauC: 0.8,
  tauU: 0.2,
  epsilon: 0.05,
  lambda: 0.1,
  mu: 0.2,
  hardGate: 1,
});

/**
 * A verifier `v_i` maps a criterion and the full agent state to a satisfaction
 * score plus evidence credibility. Verifiers are deterministic and stateless;
 * the registry holds them so the controller never inspects criterion text.
 */
export interface Verifier {
  readonly id: string;
  readonly description: string;
  evaluate(criterion: AcceptanceCriterion, state: AgentState): CriterionEvaluation;
}

/** A candidate action for VOC estimation. */
export interface CandidateAction {
  readonly name: string;
  readonly kind: "tool" | "coordination" | "text";
  readonly args?: Readonly<Record<string, unknown>>;
}

/** Result of estimating value of continuation across candidate actions. */
export interface ValueOfContinuation {
  readonly perAction: ReadonlyMap<string, number>;
  /** `VOC*_t = max_a VOC_t(a)`. */
  readonly star: number;
  readonly bestAction: string | undefined;
}

/** Embedding adapter the semantic residual engine may use (zero-training). */
export interface EmbeddingAdapter {
  embed(texts: readonly string[]): Promise<readonly number[][]>;
  readonly dimensions: number;
}

/** Input the controller evaluates each turn. */
export interface ControlEvaluationInput {
  readonly contract: GoalContract;
  readonly state: AgentState;
  readonly candidateActions: readonly CandidateAction[];
  /** LLM's own "I am done" signal, if it called the done tool this turn. */
  readonly llmDoneSignal: boolean;
}

/** Pause handle returned when the controller verdicts ASK_USER. The loop awaits
 *  the promise, the host resolves it with the user's answer, and the loop
 *  resumes — injecting the answer as a new user message. */
export interface PauseHandle {
  readonly question: string;
  readonly options?: readonly string[];
  readonly answer: Promise<string>;
}
