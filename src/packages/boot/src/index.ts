export type {
  BootConfig,
  BootMemoryOSConfig,
  BootFileOSConfig,
  CantilunOS,
  RunResult,
  RunOptions,
  CantilunOSRunOptions,
  RunOperationTally,
  RunToolTally,
  RunError,
  AgentErrorPhase,
  AgentLoopHistory,
  ProgressEvent,
  AgentEvent,
  TokenUsage,
  ContextUsage,
  LlmConfig,
  LlmAdapter,
  LlmChatRequest,
  LlmChatResponse,
  LlmStreamChunk,
  LlmMessage,
  LlmToolDef,
  LlmToolCallOutput,
  LlmToolCallResult,
  CompositeToolExecutor,
} from "./types.js";
export type { BootDependencies } from "./bootCantilune.js";
export type { AgentLoopConfig } from "./agentLoop.js";
export {
  BOOT_EPOCH_ID,
  bootCantilune,
  bootMemoryOS,
  bootFileOS,
  DEFAULT_TEMPLATES,
} from "./bootCantilune.js";
/** ADR-0023 / ADR-0029: Postgres HA or official etcd Raft. */
export {
  createDurableCoordinatorFromEnv,
  resolveProductionDurable,
} from "@cantilune/runtime/memory";
export { wrapCoordinationRuntime } from "./runtimeAdapter.js";
export * from "./swarm/index.js";
/** Low-level: run the agent loop directly (for testing or custom boot logic). */
export {
  buildDefaultSystemPrompt,
  createAgentLoopHistory,
  requireAgentLoopHistory,
  runAgentLoop,
} from "./agentLoop.js";
export { mergeToolExecutors, invalidateToolIndex } from "./toolMerge.js";
export {
  CONTEXT_WINDOW_EXCEEDED,
  LlmProviderError,
  isContextWindowExceededError,
  providerHttpError,
} from "./llmError.js";
export type { ContextCompactionPolicy } from "./context/contextCompaction.js";
export type { ToolResultPrunePolicy } from "./context/toolResultPruner.js";
export * from "./cluster/index.js";

// Termination controller — the zero-training, math-first authority that owns
// every run's termination decision. Replaces the former CompletionDetector.
export {
  createTerminationController,
  type TerminationController,
  type TerminationControllerOptions,
} from "./termination/index.js";
export type {
  ControlVerdict,
  ControllerThresholds,
  GoalContract,
  AcceptanceCriterion,
  CriterionEvaluation,
  TerminationAudit,
  Verifier,
  CandidateAction,
  ValueOfContinuation,
  EmbeddingAdapter,
  AgentState,
  EvidenceTier,
  PauseHandle,
} from "./termination/index.js";
export { DEFAULT_THRESHOLDS } from "./termination/index.js";
export {
  createDefaultVerifierRegistry,
  VerifierRegistry,
  NO_INFINITE_LOOP_VERIFIER,
  DUPLICATE_REPLY_VERIFIER,
  COORDINATION_PROGRESS_VERIFIER,
  TASK_ARTIFACT_EXISTS_VERIFIER,
  STRUCTURED_RUBRIC_VERIFIER,
  collectAgentState,
  compileGoalContract,
  defaultSystemContract,
  computeResidual,
  coverageFromResidual,
  estimateVOC,
  decide,
} from "./termination/index.js";
