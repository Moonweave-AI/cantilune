import type { LlmAdapter } from "../types.js";
import { compileGoalContract } from "./goalContract.js";
import { createJudgeAuditJournal } from "./judgeAudit.js";
import type { JudgeAuditJournal } from "./judgeAudit.js";
import { createJudgeVerifier } from "./judgeVerifier.js";
import type { JudgeVerifier } from "./judgeVerifier.js";
import {
  createJudgeBudgetPolicy,
  type JudgeBudgetLimits,
} from "./judgeBudget.js";
import { computeResidual } from "./semanticResidual.js";
import { decide } from "./terminationStateMachine.js";
import type {
  AgentState,
  ControlEvaluationInput,
  ControlVerdict,
  ControllerThresholds,
  CriterionEvaluation,
  EmbeddingAdapter,
  GoalContract,
  Verifier,
} from "./types.js";
import { DEFAULT_THRESHOLDS } from "./types.js";
import { estimateVOC } from "./valueOfContinuation.js";
import {
  COORDINATION_PROGRESS_VERIFIER,
  DUPLICATE_REPLY_VERIFIER,
  NO_INFINITE_LOOP_VERIFIER,
  STRUCTURED_RUBRIC_VERIFIER,
  TASK_ARTIFACT_EXISTS_VERIFIER,
  VerifierRegistry,
} from "./verifierRegistry.js";

export * from "./types.js";
export { compileGoalContract, defaultSystemContract } from "./goalContract.js";
export { createDefaultVerifierRegistry, VerifierRegistry } from "./verifierRegistry.js";
export {
  NO_INFINITE_LOOP_VERIFIER,
  DUPLICATE_REPLY_VERIFIER,
  COORDINATION_PROGRESS_VERIFIER,
  TASK_ARTIFACT_EXISTS_VERIFIER,
  STRUCTURED_RUBRIC_VERIFIER,
} from "./verifierRegistry.js";
export { collectAgentState } from "./stateEvidenceLedger.js";
export type { WorldSnapshot, TraceCounts, RunProduce } from "./stateEvidenceLedger.js";
export { computeResidual, coverageFromResidual } from "./semanticResidual.js";
export { estimateVOC } from "./valueOfContinuation.js";
export { decide } from "./terminationStateMachine.js";
export { createJudgeVerifier, LLM_JUDGE_VERIFIER_ID } from "./judgeVerifier.js";
export type { JudgeVerifier, JudgeVerifierOptions, JudgeCache } from "./judgeVerifier.js";
export { createJudgeAuditJournal } from "./judgeAudit.js";
export type { JudgeAuditJournal } from "./judgeAudit.js";
export {
  createJudgeBudgetPolicy,
  type JudgeBudgetPolicy,
  type JudgeBudgetLimits,
  type JudgeBudgetSnapshot,
} from "./judgeBudget.js";
export { frozenCalibrationSamples, runCalibration } from "./judgeCalibration.js";
export type { JudgeCalibrationSample, JudgeCalibrationReport } from "./judgeCalibration.js";

const BUILTIN_VERIFIERS: readonly Verifier[] = Object.freeze([
  NO_INFINITE_LOOP_VERIFIER,
  DUPLICATE_REPLY_VERIFIER,
  COORDINATION_PROGRESS_VERIFIER,
  TASK_ARTIFACT_EXISTS_VERIFIER,
  STRUCTURED_RUBRIC_VERIFIER,
]);

/**
 * A termination controller ties the six components together and owns every
 * termination decision for one run. The LLM is used only for contract drafting
 * (once) and never for termination authority.
 */
export interface TerminationController {
  /** Compile (and freeze) the goal contract for the run, once. Cached thereafter. */
  compileContract(instruction: string): Promise<GoalContract>;
  /** Evaluate one turn and return a verdict with an auditable trail. */
  evaluateTurn(input: ControlEvaluationInput): Promise<ControlVerdict>;
  readonly contract: () => GoalContract | undefined;
}

export interface TerminationControllerOptions {
  readonly llm?: LlmAdapter;
  readonly embedder?: EmbeddingAdapter;
  readonly registry?: VerifierRegistry;
  readonly thresholds?: Partial<ControllerThresholds>;
  readonly extraVerifiers?: readonly Verifier[];
  /**
   * Dedicated LLM adapter for the soft-criterion LLM judge (ADR-0020). When
   * absent the controller keeps the deterministic `structured_rubric`
   * placeholder (ρ=0.3, fail-closed) and makes no judge LLM call. The judge
   * never overrides a hard failure. See {@link BootConfig.judgeLlm}.
   */
  readonly judgeLlm?: LlmAdapter;
  /**
   * Additional judge adapters forming a multi-judge quorum (ADR-0020 §5). When
   * non-empty, soft criteria with `verifierId="llm_judge"` are scored by the
   * median across all judges; inter-rater spread is recorded in the audit. The
   * primary {@link judgeLlm} (if present) is the first member; these are the
   * additional members. Empty (default) means single-judge or placeholder.
   */
  readonly judgeQuorum?: readonly LlmAdapter[];
  /**
   * ADR-0020 J4: ceilings on judge calls. When exhausted with hardKillEnabled,
   * further judge pre-passes are skipped (fail-closed placeholder remains).
   */
  readonly judgeBudget?: JudgeBudgetLimits;
}

export function createTerminationController(
  options: TerminationControllerOptions = {},
): TerminationController {
  const finalRegistry =
    options.registry ??
    new VerifierRegistry([...BUILTIN_VERIFIERS, ...(options.extraVerifiers ?? [])]);
  const thresholds: ControllerThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...options.thresholds,
  };
  let contractCache: GoalContract | undefined;
  let tickCounter = 0;
  const judgeBudget =
    options.judgeBudget !== undefined ? createJudgeBudgetPolicy(options.judgeBudget) : undefined;

  // ADR-0020: construct the LLM judge (if an adapter is provided) and register
  // it as an additional verifier. The judge never replaces the structured_rubric
  // placeholder — the placeholder stays as the fail-closed fallback for any
  // soft criterion the contract routes to "structured_rubric" instead of "llm_judge".
  const judgeJournal: JudgeAuditJournal | undefined = options.judgeLlm
    ? createJudgeAuditJournal()
    : undefined;
  const judge: JudgeVerifier | undefined = options.judgeLlm
    ? createJudgeVerifier(
        {
          judgeLlm: options.judgeLlm,
          ...(options.judgeQuorum === undefined ? {} : { judgeQuorum: options.judgeQuorum }),
          rho: 0.5,
        },
        {
          contractDigest: () => contractCache?.contractId ?? "no-contract",
          tick: () => tickCounter,
        },
      )
    : undefined;
  const registryWithJudge =
    judge !== undefined
      ? new VerifierRegistry([
          ...BUILTIN_VERIFIERS,
          judge.verifier,
          ...(options.extraVerifiers ?? []),
        ])
      : finalRegistry;

  function evaluateAll(contract: GoalContract, state: AgentState): CriterionEvaluation[] {
    return contract.criteria.map((c) => registryWithJudge.evaluate(c.verifierId, c, state));
  }

  async function compileContractInternal(instruction: string): Promise<GoalContract> {
    if (contractCache !== undefined) return contractCache;
    contractCache = await compileGoalContract(
      instruction,
      options.llm,
      finalRegistry,
      new Date().toISOString(),
    );
    return contractCache;
  }

  async function evaluateTurnInternal(input: ControlEvaluationInput): Promise<ControlVerdict> {
    const contract = input.contract;
    tickCounter += 1;
    // ADR-0020 §2: async pre-pass for the LLM judge BEFORE the synchronous
    // evaluateAll. The pre-pass populates a per-tick cache the judge verifier
    // reads synchronously. A judge failure is caught inside the pre-pass and
    // leaves the cache empty → the judge verifier fails closed (ρ=0.3).
    if (judge !== undefined) {
      if (judgeBudget?.isHardKilled() === true) {
        // Hard-kill: skip judge LLM; soft criteria fall back to placeholder ρ.
      } else {
        const reservation = judgeBudget?.reserve({ tokens: 512, costUsd: 0.01 });
        if (reservation === undefined || reservation.ok) {
          const started = Date.now();
          await judge.cache.prepass(contract, input.state);
          if (reservation !== undefined && reservation.ok) {
            judgeBudget?.reconcile({
              reservationId: reservation.reservation.reservationId,
              actualTokens: 512,
              actualCostUsd: 0.01,
              wallMs: Date.now() - started,
            });
          }
        }
      }
    }
    const evaluations = evaluateAll(contract, input.state);
    const residualResult = await computeResidual(contract, input.state, options.embedder);
    const voc = estimateVOC(contract, evaluations, input.candidateActions, thresholds);
    const verdict = decide({
      contract,
      evaluations,
      voc,
      residual: residualResult.residual,
      thresholds,
      llmDoneSignal: input.llmDoneSignal,
    });
    // Attach the turn's judge call records to the verdict audit (ADR-0020 §6).
    if (judge !== undefined && judgeJournal !== undefined) {
      judge.cache.flushTo(judgeJournal);
      const judgeRecords = judgeJournal.drain();
      if (judgeRecords.length > 0) {
        return { ...verdict, audit: { ...verdict.audit, judgeRecords } };
      }
    }
    return verdict;
  }

  return {
    compileContract: compileContractInternal,
    evaluateTurn: evaluateTurnInternal,
    contract: () => contractCache,
  };
}
