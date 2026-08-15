import type { ContentDigest } from "@cantilune/core";
import type { EvaluationResult } from "../foundation/evaluationResult.js";
import type { EvaluationRun, RunAttempt } from "../execution/evaluationRun.js";
import type { MetricObservation } from "../scoring/metricObservation.js";
import type { ClaimDecision } from "../review/claimDecision.js";
import type { EvaluationReport } from "../reports/evaluationReport.js";
import type { BudgetLedger } from "../budget/evaluationBudget.js";
import type { PublishableEvaluationReport } from "../foundation/opaqueTokens.js";
import type {
  EvaluationRunId,
  RunAttemptId,
  EvaluationClaimId,
  BudgetPolicyId,
  ReportId,
} from "../foundation/evaluationIds.js";

export interface RunStore {
  save(run: EvaluationRun): Promise<EvaluationResult<void>>;
  get(runId: EvaluationRunId): Promise<EvaluationRun | undefined>;
  listByPlan(planRef: string): Promise<readonly EvaluationRun[]>;
  saveAttempt(attempt: RunAttempt): Promise<EvaluationResult<void>>;
  getAttempt(attemptId: RunAttemptId): Promise<RunAttempt | undefined>;
  listAttempts(runId: EvaluationRunId): Promise<readonly RunAttempt[]>;
}

export interface ResultStore {
  saveObservation(obs: MetricObservation): Promise<EvaluationResult<void>>;
  getObservations(runId: EvaluationRunId): Promise<readonly MetricObservation[]>;
  getObservationsByMetric(metricRef: string): Promise<readonly MetricObservation[]>;
}

export interface ClaimLedger {
  append(entry: ClaimLedgerEntry): Promise<EvaluationResult<void>>;
  getHistory(claimRef: EvaluationClaimId): Promise<readonly ClaimLedgerEntry[]>;
  getLatestDecision(claimRef: EvaluationClaimId): Promise<ClaimDecision | undefined>;
  verifyChain(): Promise<EvaluationResult<void>>;
}

export interface ClaimLedgerEntry {
  readonly claimRef: EvaluationClaimId;
  readonly action: ClaimLedgerAction;
  readonly decision: ClaimDecision | undefined;
  readonly previousDigest: ContentDigest | undefined;
  readonly entryDigest: ContentDigest;
  readonly timestamp: string;
}

export type ClaimLedgerAction =
  "protocolFrozen" | "measured" | "decided" | "reviewed" | "published" | "superseded" | "retracted";

export interface BudgetLedgerPort {
  get(policyRef: BudgetPolicyId): Promise<BudgetLedger | undefined>;
  save(ledger: BudgetLedger): Promise<EvaluationResult<void>>;
}

export interface ContentAddressedStore {
  put(data: Uint8Array): Promise<EvaluationResult<ContentDigest>>;
  get(digest: ContentDigest): Promise<EvaluationResult<Uint8Array>>;
  has(digest: ContentDigest): Promise<boolean>;
}

export interface RateLimiter {
  acquire(resource: string, count: number): Promise<boolean>;
  release(resource: string, count: number): Promise<void>;
}

export interface SecretProvider {
  getSecret(key: string): Promise<string | undefined>;
}

export interface Clock {
  now(): string;
  nowMs(): number;
}

export interface RandomSource {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
  seed(value: number): void;
}

export interface AuditSink {
  emit(event: AuditEvent): Promise<void>;
}

export interface AuditEvent {
  readonly eventType: string;
  readonly actor: string;
  readonly resource: string;
  readonly action: string;
  readonly outcome: string;
  readonly timestamp: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface KillSwitch {
  isTriggered(): Promise<boolean>;
  trigger(reason: string): Promise<void>;
  reset(): Promise<void>;
}

export interface ReportPublisher {
  publish(
    report: EvaluationReport,
    sealedToken: PublishableEvaluationReport,
  ): Promise<EvaluationResult<string>>;
  retract(reportId: ReportId, reason: string): Promise<EvaluationResult<void>>;
}
