import type { ContentDigest } from "@cantilune/core";
import type {
  EvaluationRunId,
  RunAttemptId,
  EvaluationRunPlanId,
  EvaluationSubjectId,
  BenchmarkCaseId,
  WorkerId,
  LeaseId,
  FencingToken,
} from "../foundation/evaluationIds.js";
import type { RunStatus, AttemptStatus } from "../foundation/evaluationStatus.js";

export interface EvaluationRun {
  readonly runId: EvaluationRunId;
  readonly planRef: EvaluationRunPlanId;
  readonly planDigest: ContentDigest;
  readonly subjectRef: EvaluationSubjectId;
  readonly status: RunStatus;
  readonly attemptIds: readonly RunAttemptId[];
  readonly currentAttemptId: RunAttemptId | undefined;
  readonly startedAt: string | undefined;
  readonly endedAt: string | undefined;
  readonly runDigest: ContentDigest;
}

export interface RunAttempt {
  readonly attemptId: RunAttemptId;
  readonly runId: EvaluationRunId;
  readonly idempotencyKey: string;
  readonly planDigest: ContentDigest;
  readonly subjectRef: EvaluationSubjectId;
  readonly caseRef: BenchmarkCaseId;
  readonly seed: number;
  readonly executionOrder: number;
  readonly status: AttemptStatus;
  readonly workerId: WorkerId;
  readonly leaseId: LeaseId;
  readonly fencingToken: FencingToken;
  readonly startedAt: string | undefined;
  readonly endedAt: string | undefined;
  readonly inputRefs: readonly string[];
  readonly outputRefs: readonly string[];
  readonly traceEvidenceRef: string | undefined;
  readonly observationEvidenceRef: string | undefined;
  readonly admissionEvidenceRef: string | undefined;
  readonly communicationEvidenceRef: string | undefined;
  readonly providerReceiptRefs: readonly string[];
  readonly rawArtifactRefs: readonly string[];
  readonly sanitizedArtifactRefs: readonly string[];
  readonly tokenUsage: TokenUsage;
  readonly toolUsage: ToolUsage;
  readonly networkUsage: NetworkUsage;
  readonly wallTime: number;
  readonly cost: CostRecord;
  readonly terminalDisposition: string | undefined;
  readonly failureCategory: string | undefined;
  readonly retryOf: RunAttemptId | undefined;
  readonly environmentCaptureRef: string | undefined;
  readonly resultDigest: ContentDigest;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface ToolUsage {
  readonly toolCalls: number;
  readonly toolErrors: number;
}

export interface NetworkUsage {
  readonly requestCount: number;
  readonly totalBytesIn: number;
  readonly totalBytesOut: number;
}

export interface CostRecord {
  readonly modelCostCents: number;
  readonly toolCostCents: number;
  readonly networkCostCents: number;
  readonly totalCostCents: number;
  readonly currency: string;
  readonly receiptRefs: readonly string[];
}
