import type { ContentDigest } from "@cantilune/core";
import type {
  EvaluationRunPlanId,
  EvaluationProtocolId,
  EvaluationClaimId,
  BenchmarkSuiteId,
  BenchmarkCaseId,
  DatasetId,
  EvaluationSubjectId,
  JudgeProtocolId,
  BudgetPolicyId,
  RubricRef,
} from "../foundation/evaluationIds.js";

export interface EvaluationRunPlan {
  readonly planId: EvaluationRunPlanId;
  readonly protocolRef: EvaluationProtocolId;
  readonly claimRefs: readonly EvaluationClaimId[];
  readonly suiteRef: BenchmarkSuiteId;
  readonly caseSelection: CaseSelection;
  readonly datasetSplitRefs: readonly DatasetId[];
  readonly candidateSubjectRef: EvaluationSubjectId;
  readonly baselineSubjectRefs: readonly EvaluationSubjectId[];
  readonly pairedExecution: boolean;
  readonly blockingFactors: readonly string[];
  readonly randomizationOrder: readonly string[];
  readonly blinding: BlindingConfig;
  readonly seeds: readonly number[];
  readonly repetitions: number;
  readonly modelProviderRevisions: readonly string[];
  readonly promptDigests: readonly ContentDigest[];
  readonly rubricRefs: readonly RubricRef[];
  readonly toolManifestRefs: readonly string[];
  readonly concurrency: number;
  readonly retryPolicy: RetryPolicy;
  readonly timeoutPolicy: TimeoutPolicy;
  readonly environmentManifest: string;
  readonly hardwareManifest: string;
  readonly budgetPolicyRef: BudgetPolicyId;
  readonly judgeProtocolRefs: readonly JudgeProtocolId[];
  readonly redactionPolicyRef: string;
  readonly exclusionPolicy: string;
  readonly planDigest: ContentDigest;
  readonly frozenAt: string | undefined;
}

export interface CaseSelection {
  readonly mode: "all" | "subset" | "stratified";
  readonly caseIds: readonly BenchmarkCaseId[] | undefined;
  readonly strata: readonly string[] | undefined;
  readonly maxCases: number | undefined;
}

export interface BlindingConfig {
  readonly candidateBlinded: boolean;
  readonly baselineBlinded: boolean;
  readonly judgeBlinded: boolean;
  readonly presentationRandomized: boolean;
}

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly retryableFailures: readonly string[];
  readonly backoffMs: number;
}

export interface TimeoutPolicy {
  readonly perCaseMs: number;
  readonly perRunMs: number;
  readonly totalMs: number;
}

export function isPlanFrozen(plan: EvaluationRunPlan): boolean {
  return plan.frozenAt !== undefined;
}
