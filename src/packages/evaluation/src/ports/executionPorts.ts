import type { ContentDigest } from "@cantilune/core";
import type { EvaluationResult } from "../foundation/evaluationResult.js";
import type { CostRecord } from "../execution/evaluationRun.js";
import type { LeaseId, FencingToken, WorkerId } from "../foundation/evaluationIds.js";

export interface CandidateRunner {
  execute(config: RunnerConfig): Promise<EvaluationResult<RunnerOutput>>;
}

export interface BaselineRunner {
  execute(config: RunnerConfig): Promise<EvaluationResult<RunnerOutput>>;
}

export interface RunnerConfig {
  readonly subjectRef: string;
  readonly caseRef: string;
  readonly inputRefs: readonly string[];
  readonly seed: number;
  readonly timeoutMs: number;
  readonly networkPolicy: string;
  readonly filesystemPolicy: string;
  readonly toolManifest: readonly string[];
  readonly environmentRef: string;
}

export interface RunnerOutput {
  readonly outputRefs: readonly string[];
  readonly traceRef: string;
  readonly wallTimeMs: number;
  readonly tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  readonly toolUsage: { toolCalls: number; toolErrors: number };
  readonly cost: CostRecord;
  readonly terminalDisposition: string;
  readonly environmentCaptureRef: string;
  readonly resultDigest: ContentDigest;
}

export interface ModelInvoker {
  invoke(prompt: string, config: ModelConfig): Promise<EvaluationResult<ModelResponse>>;
}

export interface ModelConfig {
  readonly provider: string;
  readonly model: string;
  readonly version: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly seed: number | undefined;
}

export interface ModelResponse {
  readonly content: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costCents: number;
  readonly receiptRef: string;
  readonly responseDigest: ContentDigest;
}

export interface ToolSandbox {
  execute(tool: string, args: unknown, policy: string): Promise<EvaluationResult<ToolOutput>>;
}

export interface ToolOutput {
  readonly result: unknown;
  readonly wallTimeMs: number;
  readonly costCents: number;
}

export interface LeaseCoordinator {
  acquireLease(workerId: WorkerId, durationMs: number): Promise<EvaluationResult<LeaseGrant>>;
  renewLease(
    leaseId: LeaseId,
    token: FencingToken,
    durationMs: number,
  ): Promise<EvaluationResult<LeaseGrant>>;
  releaseLease(leaseId: LeaseId, token: FencingToken): Promise<EvaluationResult<void>>;
  validateFencingToken(leaseId: LeaseId, token: FencingToken): Promise<boolean>;
}

export interface LeaseGrant {
  readonly leaseId: LeaseId;
  readonly fencingToken: FencingToken;
  readonly expiresAt: string;
}

export interface EnvironmentCapture {
  capture(): Promise<EvaluationResult<EnvironmentSnapshot>>;
}

export interface EnvironmentSnapshot {
  readonly os: string;
  readonly arch: string;
  readonly nodeVersion: string;
  readonly hardwareManifest: string;
  readonly capturedAt: string;
  readonly snapshotDigest: ContentDigest;
}

export interface ProviderReceiptVerifier {
  verify(receiptRef: string, expectedCost: CostRecord): Promise<EvaluationResult<void>>;
}
