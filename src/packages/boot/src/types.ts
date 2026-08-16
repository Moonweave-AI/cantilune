/// <reference types="node" />
import type { ContentRef, TranscriptMessage, TranscriptToolCall } from "@cantilune/core";
import type { ToolApprover, ToolExecutor, ToolObservationRecovery } from "@cantilune/syscall";
import type {
  ControlVerdict,
  ControllerThresholds,
  EmbeddingAdapter,
} from "./termination/types.js";

/**
 * Configuration to boot a Cantilune OS instance.
 */
export interface BootConfig {
  /** Storage backend for runtime durability. "memory" for ephemeral, "file" for persistent. */
  readonly durable: "memory" | "file";
  /** Content store backend. "memory" for ephemeral, "file" for persistent. */
  readonly contentStore: "memory" | "file";
  /** File path for durable/content stores when using "file" backends. */
  readonly storagePath?: string;
  /** LLM provider configuration. */
  readonly llm: LlmConfig;
  /** Optional external tools (MCP servers, file ops, terminal, etc). */
  readonly tools?: ToolExecutor[];
  /**
   * Human authorization gate consulted before a side-effecting tool dispatches
   * (ADR-0016 tiers decide which). Absent means tools run unattended, which is
   * the behaviour of every embedding written before this port existed — an
   * unattended swarm worker, for instance, has no human to ask.
   */
  readonly toolApprover?: ToolApprover;
  /** Principal identity for this OS instance. Defaults to auto-generated UUID. */
  readonly principalId?: string;
  /** Principal kind for this OS instance. Defaults to "agent". */
  readonly principalKind?: string;
  /** Custom system prompt to prepend or replace the default. */
  readonly systemPrompt?: string;
  /** Maximum turns before forced termination. Default: 100. */
  readonly maxTurns?: number;
  /**
   * Orchestration/LLM budget in milliseconds. Default: 600_000 (10 minutes).
   * It prevents new turns and bounds LLM waits; it cannot safely preempt an
   * already-running external side effect until executors support cancellation
   * plus idempotent outcome reconciliation (ADR-0012 SS-03).
   */
  readonly maxTimeMs?: number;
  /** Maximum messages retained in LLM context (sliding window). Default: 40. */
  readonly maxContextMessages?: number;
  /**
   * Trusted transcript seed used only when an OS instance creates its private
   * conversation history. Incomplete tool-call/result groups are discarded by
   * the agent loop instead of being presented to the LLM as executed work.
   */
  readonly initialMessages?: readonly LlmMessage[];
  /**
   * Trusted private loop state restored by the embedding host. Unlike
   * `initialMessages`, this preserves exact assistant tool calls, tool results,
   * and unresolved external-observation receipts. Boot validates and detaches
   * the value before the first instruction enters the world.
   */
  readonly history?: AgentLoopHistory;
  /**
   * Awaited after each completed turn once exact private history has been
   * synchronized. A persistence failure terminates the run before another LLM
   * turn can consume evidence that was not durably checkpointed.
   */
  readonly onHistoryCheckpoint?: (history: AgentLoopHistory) => void | Promise<void>;
  /**
   * Awaited at the start of each turn before `availableActions` (ADR-0026).
   * Used to apply a pending MCP tool surface so the current turn never sees
   * mid-turn mutation and the next turn lists the new epoch's tools.
   */
  readonly onBeforeTurn?: (turn: number) => void | Promise<void>;
  /**
   * Owner-reviewed aliases that are known to have used the exact built-in
   * static schema. Epoch names are not proof of schema identity; this list is
   * an explicit migration authorization and defaults to empty.
   */
  readonly compatibleEpochIds?: readonly string[];
  /**
   * Optional embedding adapter for the termination controller's semantic
   * residual engine. When absent the controller falls back to keyword/Jaccard
   * matching, so the controller works fully offline.
   */
  readonly embedder?: EmbeddingAdapter;
  /**
   * Optional overrides for the termination controller's thresholds (τ_C, τ_U,
   * ε, λ, μ). Unspecified fields keep their defaults in DEFAULT_THRESHOLDS.
   */
  readonly thresholds?: Partial<ControllerThresholds>;
  /**
   * Dedicated LLM adapter for goal-contract compilation only. The contract
   * compiler drafts acceptance criteria once per run and never owns
   * termination; it must not share the adapter that drives the agent loop,
   * because a shared adapter consumes one of the loop's LLM calls and shifts
   * every scripted response sequence (and in production it adds one billed
   * call per run to the loop's latency). When absent, the controller compiles
   * the default system contract without any LLM call — it never falls back to
   * the loop's adapter. Point this at a smaller/faster model to draft
   * contracts cheaply.
   */
  readonly contractLlm?: LlmAdapter;
  /**
   * Dedicated LLM adapter for the soft-criterion LLM judge (ADR-0020). The
   * judge scores only soft acceptance criteria whose `verifierId` is
   * `"llm_judge"`; it never owns termination authority and never overrides a
   * hard failure. It must not share the loop's adapter (self-assessment
   * contamination: the loop adapter already produced the reply it would judge)
   * and must not share the contract compiler's adapter (different concern,
   * different billing). When absent, the controller keeps the deterministic
   * `structured_rubric` placeholder (ρ=0.3, fail-closed) and makes no judge LLM
   * call — it never falls back to the loop's adapter. Point this at a model
   * distinct from the loop and contract adapters. Multi-judge quorum is
   * configured by passing multiple adapters via the controller options, not
   * here; this field is the single primary judge.
   */
  readonly judgeLlm?: LlmAdapter;
}

/** Config for {@link bootMemoryOS}: all BootConfig fields except fixed backends; `llm` is required. */
export type BootMemoryOSConfig = Partial<Omit<BootConfig, "durable" | "contentStore">> & {
  readonly llm: LlmConfig;
};

/** Config for {@link bootFileOS}: file-backed durable + content; `storagePath` and `llm` are required. */
export type BootFileOSConfig = Partial<Omit<BootConfig, "durable" | "contentStore">> & {
  readonly storagePath: string;
  readonly llm: LlmConfig;
};

/**
 * LLM provider configuration.
 * The boot layer is provider-agnostic. Any LLM that supports function calling works.
 * Only "tool calling" mode is supported (not legacy "function calling").
 */
export interface LlmConfig {
  /** Provider name: "openai" | "anthropic" | "google" | "local" | custom string. */
  readonly provider: string;
  /** Model identifier (e.g., "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.5-pro"). */
  readonly model: string;
  /**
   * API key accessor. Returns the key string.
   * Use a function to prevent accidental serialization of secrets.
   * If omitted, the adapter is expected to handle auth internally.
   */
  readonly apiKey?: () => string;
  /** Base URL override for API endpoint. */
  readonly baseUrl?: string;
  /** Maximum tokens per response. */
  readonly maxTokens?: number;
  /** Temperature for sampling. */
  readonly temperature?: number;
}

/**
 * Represents a booted Cantilune OS instance ready to accept user input.
 */
export interface CantilunOS {
  /** Run a user instruction end-to-end. Returns when the LLM declares done or limits are hit. */
  run(instruction: string, options?: CantilunOSRunOptions): Promise<RunResult>;
  /**
   * Export a detached, strictly validated snapshot of the history this OS uses.
   * ADR-0021 also commits the same rows onto CollaborationSnapshot.transcripts.
   */
  readonly privateHistory?: () => AgentLoopHistory;
  /** Shut down gracefully. Flushes pending writes if applicable. */
  shutdown(): Promise<void>;
}

/** Per-run observers/cancellation for an OS-owned private conversation. */
export type CantilunOSRunOptions = Omit<RunOptions, "history">;

export interface RunOptions {
  /** AbortSignal for cancellation. */
  readonly signal?: AbortSignal;
  /** Progress callback, invoked after each LLM turn. */
  readonly onProgress?: (event: ProgressEvent) => void;
  /**
   * Fine-grained event callback covering the whole turn lifecycle:
   * LLM token deltas, tool start/end, and turn boundaries.
   * Prefer this over {@link RunOptions.onProgress} for live UIs.
   */
  readonly onEvent?: (event: AgentEvent) => void;
  /**
   * Optional reusable private conversation state. Low-level callers can share
   * one instance across runs; booted OS instances normally own this internally.
   */
  readonly history?: AgentLoopHistory;
  /**
   * Called when the termination controller verdicts ASK_USER. The loop awaits
   * the returned answer and injects it as a new user message, then continues.
   * If absent, an ASK_USER verdict degrades to STALLED (no one to ask).
   */
  readonly onAskUser?: (question: string, options?: readonly string[]) => Promise<string>;
}

/**
 * Mutable, caller-owned conversation state for reuse across `runAgentLoop`
 * calls. The array identity is stable so observers can retain the state object
 * while the loop replaces its validated/compacted contents in place.
 */
export interface AgentLoopHistory {
  readonly messages: LlmMessage[];
  /**
   * Pending external-tool observations. Callers may serialize this alongside
   * `messages`; it contains ContentRefs and call identities, never tool output.
   */
  readonly pendingToolObservations: ToolObservationRecovery[];
}

export interface ProgressEvent {
  readonly turn: number;
  readonly elapsedMs: number;
  readonly lastAction: string;
}

/**
 * Fine-grained agent lifecycle events.
 *
 * The loop emits these in order within each turn:
 *   turn_start → llm_start → llm_delta* → llm_end
 *              → (tool_start → tool_end)* → turn_end
 *
 * `llm_delta` is only emitted when the adapter supports streaming.
 * Consumers must tolerate its absence (non-streaming adapters jump
 * straight from `llm_start` to `llm_end`).
 */
export type AgentErrorPhase = "configuration" | "llm" | "tool" | "perceive" | "available_actions";

export type AgentEvent =
  | { readonly kind: "turn_start"; readonly turn: number; readonly elapsedMs: number }
  | { readonly kind: "llm_start"; readonly turn: number; readonly model?: string }
  | { readonly kind: "llm_delta"; readonly turn: number; readonly text: string }
  | {
      readonly kind: "llm_end";
      readonly turn: number;
      readonly text: string;
      readonly toolCalls: readonly LlmToolCallResult[];
      readonly usage?: TokenUsage;
    }
  | {
      readonly kind: "tool_start";
      readonly turn: number;
      readonly toolCallId: string;
      readonly name: string;
      readonly arguments: Record<string, unknown>;
      /** True for coordination tools (delegate/transfer/etc), to let the TUI style them distinctly. */
      readonly coordination?: boolean;
    }
  | {
      readonly kind: "tool_end";
      readonly turn: number;
      readonly toolCallId: string;
      readonly name: string;
      readonly ok: boolean;
      readonly output: string;
      /** True for coordination tools, mirroring `tool_start.coordination`. */
      readonly coordination?: boolean;
    }
  | {
      readonly kind: "turn_end";
      readonly turn: number;
      readonly elapsedMs: number;
      readonly lastAction: string;
    }
  | {
      readonly kind: "error";
      readonly turn: number;
      readonly phase: AgentErrorPhase;
      readonly message: string;
      readonly retryable: boolean;
      /**
       * Structured diagnostic detail carried alongside the message when the
       * loop can name what went wrong at sub-message granularity — e.g. which
       * stream frame or field failed validation. Absent on legacy errors that
       * only have a free-text message. Consumers render it when present so a
       * user can locate the fault without re-running with verbose logging.
       */
      readonly detail?: string;
    }
  | {
      readonly kind: "control_verdict";
      readonly turn: number;
      readonly verdict: ControlVerdict;
    }
  | {
      readonly kind: "ask_user";
      readonly turn: number;
      readonly question: string;
      readonly options?: readonly string[];
    }
  | {
      /**
       * A non-fatal observation of an underlying behavior the user would
       * otherwise not see: a malformed stream frame that was skipped rather
       * than allowed to kill the run, a provider drift the adapter
       * normalized, a model that wrote a pseudo-tool-call in prose instead
       * of invoking the tool. Diagnostics never change the run's control
       * flow; they exist to make the intermediate process observable.
       */
      readonly kind: "diagnostic";
      readonly turn: number;
      readonly phase: AgentErrorPhase | "stream";
      readonly message: string;
      readonly detail?: string;
    };

export interface TokenUsage {
  readonly prompt: number;
  readonly completion: number;
  readonly total: number;
}

export interface RunResult {
  readonly ok: boolean;
  /** Human-readable final outcome. */
  readonly summary: string;
  /** Number of LLM turns used. */
  readonly turns: number;
  /** Wall-clock time in milliseconds. */
  readonly elapsedMs: number;
  /** Content refs produced during the run. */
  readonly producedRefs: readonly ContentRef[];
  /** Reason the run terminated. `done`/`controller` are goal-complete; others are failures/limits. */
  readonly terminationReason?:
    "done" | "controller" | "max_turns" | "max_time" | "aborted" | "error";
  /**
   * Tally of the coordination operations the agent attempted. Reported because
   * an agent's own summary is not evidence: a run whose every operation was
   * refused could still declare success, and the caller had no way to tell.
   */
  readonly operations: RunOperationTally;
  /**
   * Tally of every LLM-requested tool call, including content, external,
   * coordination, and `done` calls. Optional only for source compatibility
   * with callers that construct legacy RunResult fixtures themselves; results
   * returned by the agent loop always include it.
   */
  readonly toolCalls?: RunToolTally;
  /** Structured terminal error when a loop phase threw or completion was untrustworthy. */
  readonly error?: RunError;
}

export interface RunOperationTally {
  /** Operations admitted and committed to the world. */
  readonly committed: number;
  /** Operations the runtime refused. */
  readonly rejected: number;
}

export interface RunToolTally {
  /** All tool calls completed by the loop, including a terminal `done` call. */
  readonly total: number;
  /** Calls whose own result was successful. */
  readonly succeeded: number;
  /** Calls that failed, including a `done` declaration rejected at settlement. */
  readonly failed: number;
  /** Failed tool/target keys that have not subsequently succeeded. */
  readonly unresolved: number;
}

export interface RunError {
  readonly phase: AgentErrorPhase;
  readonly message: string;
  readonly retryable: boolean;
  readonly toolCallId?: string;
  readonly toolName?: string;
}

/**
 * The LLM adapter interface — what boot needs from any LLM.
 * Implementations wrap provider-specific SDKs (OpenAI, Anthropic, etc).
 */
export interface LlmAdapter {
  /**
   * Send messages + available tools to the LLM, get back either a text response
   * or one or more tool calls. Must throw on unrecoverable errors (network, auth).
   */
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
  /**
   * Streaming variant. Yields incremental chunks, then a final `done` chunk
   * carrying the assembled response. Optional — callers must fall back to
   * {@link LlmAdapter.chat} when absent.
   */
  stream?(request: LlmChatRequest): AsyncIterable<LlmStreamChunk>;
}

/**
 * A single streamed unit from the LLM.
 *
 * `text_delta` carries incremental assistant prose. `tool_call_delta` carries
 * incremental tool-call JSON (providers emit arguments in fragments). `done`
 * terminates the stream and carries the fully assembled response so callers
 * never need to reassemble fragments themselves.
 */
export type LlmStreamChunk =
  | { readonly kind: "text_delta"; readonly text: string }
  | {
      readonly kind: "tool_call_delta";
      readonly index: number;
      readonly id?: string;
      readonly name?: string;
      readonly argumentsDelta?: string;
    }
  | { readonly kind: "done"; readonly response: LlmChatResponse };

export interface LlmChatRequest {
  readonly messages: readonly LlmMessage[];
  readonly tools: readonly LlmToolDef[];
  /** Cancellation signal forwarded to the underlying HTTP request. */
  readonly signal?: AbortSignal;
}

/**
 * LLM chat row. Same contract as core `TranscriptMessage` (ADR-0021 / P1):
 * boot composes the world type instead of keeping a parallel identity.
 */
export type LlmMessage = TranscriptMessage;
export type LlmToolCallOutput = TranscriptToolCall;

export interface LlmToolDef {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface LlmChatResponse {
  /** If the LLM produced a final text answer (no tool calls). */
  readonly text: string | undefined;
  /** Tool calls to execute. Empty array means text-only response. */
  readonly toolCalls: readonly LlmToolCallResult[];
  /** Stop reason. */
  readonly finishReason: "stop" | "tool_calls" | "length" | "error";
  /** Token accounting, when the provider reports it. */
  readonly usage?: TokenUsage;
}

export interface LlmToolCallResult {
  readonly id: string;
  readonly name: string;
  /**
   * Tool call arguments. For Cantilune builtin ops: Record<string, string>.
   * For external tools: may contain non-string values.
   *
   * `cantiluneRecoveryOf`, when present, is loop metadata naming the exact
   * unresolved same-tool call that a successful corrected/alternative call
   * replaces. The loop strips it before dispatching the operation. Exact
   * retries do not need the metadata because their normalized arguments match.
   */
  readonly arguments: LlmToolCallArguments;
}

export interface LlmToolCallArguments extends Record<string, unknown> {
  readonly cantiluneRecoveryOf?: string;
}

/**
 * Composite tool executor that merges multiple executors.
 */
export interface CompositeToolExecutor extends ToolExecutor {
  readonly executors: readonly ToolExecutor[];
}
