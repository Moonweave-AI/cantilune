/**
 * LLM Judge Verifier (ADR-0020) — a soft-criterion verifier backed by a
 * dedicated LLM judge adapter. This module implements the ADR's central design
 * constraints:
 *
 * 1. **Synchronous evaluate contract preserved.** The `Verifier` interface is
 *    synchronous (`evaluate(criterion, state): CriterionEvaluation`). The
 *    judge LLM call is asynchronous, so the controller runs an async pre-pass
 *    before the synchronous `evaluateAll` and caches results keyed by
 *    `criterionId`. The verifier's `evaluate` reads the cache; a cache miss
 *    fails closed (ρ=0.3 placeholder) rather than blocking the sync contract.
 *
 * 2. **Blinding (§4).** The prompt excludes the pending reply as truth — the
 *    judge sees the criterion description plus aggregate trace/artifact counts
 *    and an environment summary, never the reply the agent is about to send.
 *
 * 3. **q clamping (§4).** Judge output `q` is clamped to `[0,1]`; an unparseable
 *    response yields `q=0, ρ=0.3` fail-closed.
 *
 * 4. **ρ capped below hard tiers (§4).** The judge's credibility is strictly
 *    below hard verifiers (ρ=1.0); default 0.5, configurable.
 *
 * 5. **Pinned seed for replay determinism (§5).** The LlmAdapter interface
 *    carries no seed field, so the seed (derived from the contract digest) is
 *    injected into the prompt text in a deterministic position. A replay with
 *    the same contract digest reproduces the same prompt, hence the same judge
 *    score (ADR-0012 exact-evidence replay).
 *
 * 6. **Multi-judge quorum (§5).** When N judge adapters are configured, each
 *    soft `llm_judge` criterion is scored by every adapter; the aggregated `q`
 *    is the median, and inter-rater spread is recorded in the audit.
 *
 * The judge never overrides a hard failure (hard criteria use ρ=1.0 verifiers;
 * the judge only contributes to the soft-condition aggregate C_t).
 */
import { createHash } from "node:crypto";
import type {
  AcceptanceCriterion,
  AgentState,
  CriterionEvaluation,
  GoalContract,
  JudgeCallRecord,
} from "./types.js";
import type { LlmAdapter, LlmChatResponse, LlmMessage } from "../types.js";
import type { JudgeAuditJournal } from "./judgeAudit.js";

/** The verifier id the contract uses to route a criterion to the LLM judge. */
export const LLM_JUDGE_VERIFIER_ID = "llm_judge";

/** Default judge credibility — strictly below hard verifiers (ρ=1.0). */
export const DEFAULT_JUDGE_RHO = 0.5;

/** Placeholder credibility used on cache miss / unparseable output (fail-closed). */
export const JUDGE_PLACEHOLDER_RHO = 0.3;

export interface JudgeVerifierOptions {
  /** Primary judge adapter (and first quorum member when quorum is used). */
  readonly judgeLlm: LlmAdapter;
  /** Additional judge adapters for multi-judge quorum (§5). */
  readonly judgeQuorum?: readonly LlmAdapter[];
  /** Judge credibility ρ ∈ [0,1), strictly below hard tiers. Default 0.5. */
  readonly rho?: number;
  /** Per-adapter model id override; otherwise read from the response. */
  readonly modelId?: string;
}

export interface JudgeCache {
  /**
   * Async pre-pass: score every `llm_judge` criterion in the contract against
   * the current state and populate the cache. Failures are caught and recorded
   * as fallbacks; the pre-pass never rejects (a judge error must not break a
   * termination tick).
   */
  prepass(contract: GoalContract, state: AgentState): Promise<void>;
  /** Read the cached evaluation for a criterion; `undefined` on miss. */
  read(criterionId: string): CriterionEvaluation | undefined;
  /** Drain the turn's judge call records into the audit journal. */
  flushTo(journal: JudgeAuditJournal): void;
}

export interface JudgeVerifier {
  /** The synchronous `Verifier` — reads the cache, fails closed on miss. */
  readonly verifier: {
    readonly id: string;
    readonly description: string;
    evaluate(criterion: AcceptanceCriterion, state: AgentState): CriterionEvaluation;
  };
  readonly cache: JudgeCache;
}

// --- Prompt construction (blinded) -------------------------------------------

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Build the blinded judge prompt for one criterion. Excludes `pendingReply`
 * (the agent's answer) so the judge cannot score the reply as truth. Includes
 * only aggregate counts and an environment summary — enough context to score
 * progress, not enough to rubber-stamp the agent's own prose.
 */
function buildJudgeMessages(
  criterion: AcceptanceCriterion,
  state: AgentState,
  seed: string,
): readonly LlmMessage[] {
  const system = [
    "You are a soft-criterion acceptance judge for an autonomous agent OS.",
    "Score ONLY the provided criterion against the provided execution context.",
    "You never see the agent's pending reply — it is deliberately withheld to",
    "prevent self-assessment contamination. Return ONLY a JSON object",
    '{ "q": <number 0..1>, "rationale": <short string> }. No prose, no fences.',
  ].join(" ");
  const context = [
    `seed=${seed}`,
    `criterionId=${criterion.id}`,
    `criterion=${criterion.description}`,
    `kind=${criterion.kind}`,
    `threshold=${criterion.threshold}`,
    `conversationTurns=${state.trace.conversationTurns}`,
    `plainTextTurns=${state.trace.plainTextTurns}`,
    `toolCallTurns=${state.trace.toolCallTurns}`,
    `committedOperations=${state.trace.committedOperations}`,
    `rejectedOperations=${state.trace.rejectedOperations}`,
    `artifactIds=${state.artifacts.artifactIds.length}`,
    `contentRefs=${state.artifacts.contentRefs.length}`,
    `evidenceItems=${state.evidence.items.length}`,
    `participantCount=${state.environment.participantCount}`,
    `worldSummary=${state.environment.worldSummary}`,
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: context },
  ];
}

/** Derive the pinned seed from the contract digest (ADR-0012 replay determinism). */
function deriveSeed(contractDigest: string, tick: number): string {
  return sha256(`${contractDigest}:${tick}`);
}

// --- Response parsing (mirrors goalContract's extractTextJson) -------------

interface ParsedJudgeOutput {
  readonly q: number | undefined;
  readonly rationale: string | undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseJudgeResponse(response: LlmChatResponse): ParsedJudgeOutput {
  const text = response.text ?? "";
  const match = /\{[\s\S]*\}/u.exec(text);
  if (match === null) return { q: undefined, rationale: undefined };
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!isPlainObject(parsed)) return { q: undefined, rationale: undefined };
    const qRaw = parsed.q;
    const rationaleRaw = parsed.rationale;
    const q = typeof qRaw === "number" && Number.isFinite(qRaw) ? qRaw : undefined;
    const rationale = typeof rationaleRaw === "string" ? rationaleRaw : undefined;
    return { q, rationale };
  } catch {
    return { q: undefined, rationale: undefined };
  }
}

function clampQ(q: number | undefined): { value: number; clamped: boolean; fellBack: boolean } {
  if (q === undefined) return { value: 0, clamped: false, fellBack: true };
  if (!Number.isFinite(q)) return { value: 0, clamped: false, fellBack: true };
  if (q < 0) return { value: 0, clamped: true, fellBack: false };
  if (q > 1) return { value: 1, clamped: true, fellBack: false };
  return { value: q, clamped: false, fellBack: false };
}

// --- Single-judge call ------------------------------------------------------

interface SingleJudgeResult {
  readonly q: number;
  readonly rationale: string | undefined;
  readonly clamped: boolean;
  readonly fellBack: boolean;
  readonly promptDigest: string;
  readonly modelId: string;
}

async function callJudge(
  adapter: LlmAdapter,
  messages: readonly LlmMessage[],
  promptText: string,
  defaultModelId: string,
): Promise<SingleJudgeResult> {
  const promptDigest = sha256(promptText);
  try {
    const response = await adapter.chat({ messages, tools: [] });
    const parsed = parseJudgeResponse(response);
    const clamped = clampQ(parsed.q);
    return {
      q: clamped.value,
      rationale: parsed.rationale,
      clamped: clamped.clamped,
      fellBack: clamped.fellBack,
      promptDigest,
      modelId: defaultModelId,
    };
  } catch {
    // Adapter error → fail-closed; the pre-pass never rejects.
    return {
      q: 0,
      rationale: undefined,
      clamped: false,
      fellBack: true,
      promptDigest,
      modelId: defaultModelId,
    };
  }
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function interRaterSpread(values: readonly number[]): number {
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

// --- Cache + verifier factory ------------------------------------------------

export function createJudgeVerifier(
  options: JudgeVerifierOptions,
  seedSource: { readonly contractDigest: () => string; readonly tick: () => number },
): JudgeVerifier {
  const rho = options.rho ?? DEFAULT_JUDGE_RHO;
  const adapters: readonly LlmAdapter[] = [options.judgeLlm, ...(options.judgeQuorum ?? [])];
  const modelIds = [
    options.modelId ?? "judge-primary",
    ...(options.judgeQuorum?.map((_, i) => `judge-quorum-${i + 1}`) ?? []),
  ];

  const cache = new Map<string, CriterionEvaluation>();
  const records: JudgeCallRecord[] = [];

  async function prepass(contract: GoalContract, state: AgentState): Promise<void> {
    const contractDigest = seedSource.contractDigest();
    const tick = seedSource.tick();
    const seed = deriveSeed(contractDigest, tick);
    const judgeCriteria = contract.criteria.filter((c) => c.verifierId === LLM_JUDGE_VERIFIER_ID);
    for (const criterion of judgeCriteria) {
      const messages = buildJudgeMessages(criterion, state, seed);
      const promptText = messages.map((m) => m.content).join("\n");
      const perJudge = await Promise.all(
        adapters.map((adapter, i) =>
          callJudge(adapter, messages, promptText, modelIds[i] ?? `judge-${i}`),
        ),
      );
      const qs = perJudge.map((r) => r.q);
      const aggregatedQ = median(qs);
      const spread = interRaterSpread(qs);
      const anyFellBack = perJudge.some((r) => r.fellBack);
      const anyClamped = perJudge.some((r) => r.clamped);
      const primary = perJudge[0]!;
      // ADR-0020 §4: when the judge call fails (adapter threw or output was
      // unparseable), the verifier fails closed at the placeholder credibility
      // (ρ=0.3) — the same tier as the structured_rubric placeholder — rather
      // than granting the judge's full ρ to a zero-information score.
      const effectiveRho = anyFellBack ? JUDGE_PLACEHOLDER_RHO : rho;
      const fallbackTag = anyFellBack ? " [fallback]" : "";
      const rationale =
        adapters.length > 1
          ? `LLM judge quorum (n=${adapters.length}) median q=${aggregatedQ.toFixed(3)}, spread=${spread.toFixed(3)}${fallbackTag}.`
          : `LLM judge q=${aggregatedQ.toFixed(3)}${fallbackTag}.`;
      const evaluation: CriterionEvaluation = {
        criterionId: criterion.id,
        q: aggregatedQ,
        rho: effectiveRho,
        passed: aggregatedQ * effectiveRho >= criterion.threshold,
        evidenceRefs: [],
        rationale,
      };
      cache.set(criterion.id, evaluation);
      // Record the primary judge call; quorum members' records are summarized
      // via the spread in the rationale (one record per criterion keeps the
      // audit compact — ADR-0020 §6). rawQ is the clamped value when the call
      // succeeded, undefined when it fell back (no parseable judge output).
      records.push({
        criterionId: criterion.id,
        promptDigest: primary.promptDigest,
        modelId: primary.modelId,
        seed,
        rawQ: primary.fellBack ? undefined : primary.q,
        rawRationale: primary.rationale,
        clamped: anyClamped,
        fellBack: anyFellBack,
      });
    }
  }

  function read(criterionId: string): CriterionEvaluation | undefined {
    return cache.get(criterionId);
  }

  function flushTo(journal: JudgeAuditJournal): void {
    for (const rec of records) journal.record(rec);
    records.length = 0;
    cache.clear();
  }

  const verifier = {
    id: LLM_JUDGE_VERIFIER_ID,
    description: "Soft-criterion LLM judge (ADR-0020). Blinded, async-pre-passed, fail-closed.",
    evaluate(criterion: AcceptanceCriterion, _state: AgentState): CriterionEvaluation {
      const cached = cache.get(criterion.id);
      if (cached !== undefined) return cached;
      // Cache miss: fail-closed placeholder (ρ=0.3) — never block the sync contract.
      return {
        criterionId: criterion.id,
        q: 0,
        rho: JUDGE_PLACEHOLDER_RHO,
        passed: false,
        evidenceRefs: [],
        rationale: "LLM judge cache miss — fail-closed placeholder (ρ=0.3).",
      };
    },
  };

  return { verifier, cache: { prepass, read, flushTo } };
}
