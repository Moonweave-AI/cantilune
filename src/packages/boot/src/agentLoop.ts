import type { ContentRef } from "@cantilune/core";
import { toolArgumentsDigest } from "@cantilune/syscall";
import type { ActionSchema, Syscall, ToolObservationRecovery } from "@cantilune/syscall";
import type {
  AgentEvent,
  LlmAdapter,
  LlmMessage,
  LlmToolDef,
  LlmChatResponse,
  LlmStreamChunk,
  LlmToolCallResult,
  AgentLoopHistory,
  AgentErrorPhase,
  RunError,
  RunOperationTally,
  RunToolTally,
  RunResult,
  RunOptions,
} from "./types.js";
import { collectAgentState } from "./termination/stateEvidenceLedger.js";
import type { WorldSnapshot, TraceCounts } from "./termination/stateEvidenceLedger.js";
import type {
  CandidateAction,
  ControlVerdict,
  GoalContract,
} from "./termination/types.js";
import type { TerminationController } from "./termination/index.js";
import { defaultSystemContract } from "./termination/goalContract.js";

const DEFAULT_MAX_TURNS = 100;
const DEFAULT_MAX_TIME_MS = 600_000;
const DEFAULT_MAX_CONTEXT_MESSAGES = 40;
const DEFAULT_PER_TURN_TIMEOUT_MS = 120_000;
const COMPACTION_MARKER_PREFIX = "[Conversation compacted:";
const RECOVERY_ARGUMENT_KEY = "cantiluneRecoveryOf";
const RETRY_TOOL_OBSERVATION = "retry_tool_observation";
const SKIPPED_TOOL_RESULT_PREFIX = "[SKIPPED: NOT EXECUTED]";

export interface AgentLoopConfig {
  readonly maxTurns: number;
  readonly maxTimeMs: number;
  readonly maxContextMessages: number;
  readonly systemPrompt?: string;
  /** Per-turn LLM call timeout in ms. Default: 120_000 (2 min). */
  readonly perTurnTimeoutMs?: number;
  /**
   * The agent's own actor id. Admission binds every operation to the calling
   * principal, so without knowing its own id the agent guesses `from` values
   * and burns turns on operations refused as `principal_invalid`.
   */
  readonly actorId?: string;
  /** Transcript seed used only when no reusable history has content yet. */
  readonly initialMessages?: readonly LlmMessage[];
  /** Reusable private history synchronized in place on every termination path. */
  readonly history?: AgentLoopHistory;
  readonly onHistoryCheckpoint?: (history: AgentLoopHistory) => void | Promise<void>;
}

/** Create caller-owned conversation state suitable for reuse across runs. */
export function createAgentLoopHistory(
  initialMessages: readonly LlmMessage[] = [],
): AgentLoopHistory {
  return {
    messages: normalizeHistoryMessages(requireHistoryMessages(initialMessages)),
    pendingToolObservations: [],
  };
}

/**
 * Running tally of every tool call and the coordination-only compatibility
 * counters exposed as `RunResult.operations`.
 *
 * Kept because the agent's `done` summary is a claim, not evidence. A run in
 * which admission refused every single operation used to be reported as a
 * success on the strength of that claim alone.
 *
 * Recovery is deliberately narrower than tool-name equality. A successful
 * call resolves either (a) the same tool with identical normalized semantic
 * arguments, or (b) one same-tool failure named by `cantiluneRecoveryOf`.
 * The latter combines an explicit causal link with the corrected call's real
 * success result; an unrelated success never erases a failure implicitly.
 */
class OperationLedger {
  private committedCount = 0;
  private rejectedCount = 0;
  private succeededCount = 0;
  private failedCount = 0;
  private readonly unresolvedByKey = new Map<string, UnresolvedToolFailure>();

  constructor(pendingToolObservations: readonly ToolObservationRecovery[] = []) {
    for (const recovery of pendingToolObservations) {
      const toolName = receiptToolName(recovery);
      const key = externalObservationKey(toolName, recovery.originalToolCallId, recovery.outputRef);
      this.unresolvedByKey.set(key, {
        toolCallId: recovery.originalToolCallId,
        toolName,
        semanticKey: `${toolName}:${recovery.argumentsDigest}`,
        observationRecovery: recovery,
      });
    }
  }

  record(
    toolCall: LlmToolCallResult,
    ok: boolean,
    coordination: boolean,
    affectsResolution = true,
  ): LedgerRecordResult {
    this.recordCounts(ok, coordination);
    if (!affectsResolution) return { resolution: "not_applicable" };
    return ok ? this.resolveSuccessfulCall(toolCall) : this.recordFailedCall(toolCall);
  }

  private recordCounts(ok: boolean, coordination: boolean): void {
    if (ok) {
      this.succeededCount++;
    } else {
      this.failedCount++;
    }

    if (coordination) {
      if (ok) this.committedCount++;
      else this.rejectedCount++;
    }
  }

  private resolveSuccessfulCall(toolCall: LlmToolCallResult): LedgerRecordResult {
    if (toolCall.name.startsWith("tool:")) return { resolution: "none" };
    const key = toolResolutionKey(toolCall);
    const recoveryOf = toolRecoveryOf(toolCall);
    if (recoveryOf === undefined) {
      return this.unresolvedByKey.delete(key) ? { resolution: "exact" } : { resolution: "none" };
    }

    if (!supportsGenericExplicitRecovery(toolCall.name)) {
      return { resolution: "invalid_explicit", recoveryOf };
    }

    const matches = [...this.unresolvedByKey.entries()].filter(
      ([, failure]) => failure.toolCallId === recoveryOf && failure.toolName === toolCall.name,
    );
    const matchedKey = matches.length === 1 ? matches[0]?.[0] : undefined;
    if (matchedKey === undefined) return { resolution: "invalid_explicit", recoveryOf };
    this.unresolvedByKey.delete(matchedKey);
    return { resolution: "explicit", recoveryOf };
  }

  private recordFailedCall(toolCall: LlmToolCallResult): LedgerRecordResult {
    const key = toolResolutionKey(toolCall);
    this.unresolvedByKey.set(key, {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      ...(toolCall.name.startsWith("tool:") ? { semanticKey: key } : {}),
    });
    return { resolution: "recorded_failure" };
  }

  recordExternalObservationFailure(
    toolCall: LlmToolCallResult,
    recovery: ToolObservationRecovery,
  ): LedgerRecordResult {
    this.recordCounts(false, false);
    const key = externalObservationKey(toolCall.name, toolCall.id, recovery.outputRef);
    this.unresolvedByKey.set(key, {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      semanticKey: `${toolCall.name}:${recovery.argumentsDigest}`,
      observationRecovery: recovery,
    });
    return { resolution: "recorded_failure" };
  }

  resolveExternalObservation(
    recovery: ToolObservationRecovery,
    retryCall: LlmToolCallResult,
  ): LedgerRecordResult {
    this.recordCounts(true, false);
    const match = [...this.unresolvedByKey.entries()].find(
      ([, failure]) =>
        failure.observationRecovery?.originalToolCallId === recovery.originalToolCallId &&
        failure.observationRecovery.outputRef === recovery.outputRef &&
        failure.observationRecovery.receiptRef === recovery.receiptRef,
    );
    if (match === undefined) {
      return { resolution: "invalid_explicit", recoveryOf: recovery.originalToolCallId };
    }
    this.unresolvedByKey.delete(match[0]);
    return { resolution: "explicit", recoveryOf: retryCall.id };
  }

  externalObservationForCall(
    toolName: string,
    originalToolCallId: string,
  ): ToolObservationRecovery | undefined {
    const matches = [...this.unresolvedByKey.values()].filter(
      (failure) =>
        failure.toolName === toolName &&
        failure.toolCallId === originalToolCallId &&
        failure.observationRecovery !== undefined,
    );
    return matches.length === 1 ? matches[0]?.observationRecovery : undefined;
  }

  externalObservationForExactRetry(
    toolCall: LlmToolCallResult,
  ): ToolObservationRecovery | undefined {
    const digest = toolArgumentsDigest(toolExecutionArguments(toolCall.arguments));
    if (digest === undefined) return undefined;
    const semanticKey = `${toolCall.name}:${digest}`;
    const matches = [...this.unresolvedByKey.values()].filter(
      (failure) =>
        failure.toolName === toolCall.name &&
        failure.semanticKey === semanticKey &&
        failure.observationRecovery !== undefined,
    );
    return matches.length === 1 ? matches[0]?.observationRecovery : undefined;
  }

  hasUnresolvedExactExternalFailure(toolCall: LlmToolCallResult): boolean {
    const semanticKey = toolResolutionKey(toolCall);
    const digest = toolArgumentsDigest(toolExecutionArguments(toolCall.arguments));
    const receiptSemanticKey = digest === undefined ? undefined : `${toolCall.name}:${digest}`;
    return [...this.unresolvedByKey.values()].some(
      (failure) =>
        failure.toolName === toolCall.name &&
        (failure.semanticKey === semanticKey || failure.semanticKey === receiptSemanticKey),
    );
  }

  pendingToolObservations(): readonly ToolObservationRecovery[] {
    return [...this.unresolvedByKey.values()].flatMap((failure) =>
      failure.observationRecovery === undefined ? [] : [failure.observationRecovery],
    );
  }

  clearPriorCompletionFailure(): void {
    this.unresolvedByKey.delete("done");
  }

  get operationTally(): RunOperationTally {
    return { committed: this.committedCount, rejected: this.rejectedCount };
  }

  get toolTally(): RunToolTally {
    return {
      total: this.succeededCount + this.failedCount,
      succeeded: this.succeededCount,
      failed: this.failedCount,
      unresolved: this.unresolvedByKey.size,
    };
  }

  get unresolvedCount(): number {
    return this.unresolvedByKey.size;
  }

  get unresolvedTools(): readonly string[] {
    return [
      ...new Set([...this.unresolvedByKey.values()].map((failure) => failure.toolName)),
    ].sort();
  }
}

interface UnresolvedToolFailure {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly semanticKey?: string;
  readonly observationRecovery?: ToolObservationRecovery;
}

type LedgerRecordResult =
  | { readonly resolution: "not_applicable" | "none" | "exact" | "recorded_failure" }
  | { readonly resolution: "explicit" | "invalid_explicit"; readonly recoveryOf: string };

function toolResolutionKey(toolCall: LlmToolCallResult): string {
  const executionArguments = toolExecutionArguments(toolCall.arguments);
  if (toolCall.name === "read_content") {
    const rawRef = executionArguments["ref"];
    return resolutionKey(toolCall, { ref: typeof rawRef === "string" ? rawRef : "" });
  }
  if (toolCall.name === "write_content") {
    const rawContent = executionArguments["content"];
    const rawMimeType = executionArguments["mimeType"];
    return resolutionKey(toolCall, {
      content: typeof rawContent === "string" ? rawContent : "",
      mimeType: typeof rawMimeType === "string" ? rawMimeType : null,
    });
  }
  if (toolCall.name === "done") return toolCall.name;
  if (toolCall.name.startsWith("tool:")) {
    return resolutionKey(toolCall, executionArguments);
  }

  return resolutionKey(toolCall, executionArguments);
}

function resolutionKey(toolCall: LlmToolCallResult, semanticArguments: unknown): string {
  const encoded = stableJson(semanticArguments);
  return encoded === undefined
    ? `${toolCall.name}:unmatchable:${toolCall.id}`
    : `${toolCall.name}:${encoded}`;
}

function toolRecoveryOf(toolCall: LlmToolCallResult): string | undefined {
  if (!supportsGenericExplicitRecovery(toolCall.name) && !toolCall.name.startsWith("tool:")) {
    return undefined;
  }
  const raw = toolCall.arguments[RECOVERY_ARGUMENT_KEY];
  return typeof raw === "string" && raw !== "" ? raw : undefined;
}

function supportsGenericExplicitRecovery(name: string): boolean {
  return name === "read_content" || name === "write_content";
}

function externalObservationKey(
  toolName: string,
  originalToolCallId: string,
  outputRef: ContentRef,
): string {
  return JSON.stringify([toolName, "observation", originalToolCallId, String(outputRef)]);
}

function receiptToolName(recovery: ToolObservationRecovery): string {
  // Receipt names are always raw executor names. The LLM action surface adds
  // exactly one namespace prefix, even when the raw name itself begins with
  // "tool:". This keeps the mapping bijective across serialized history.
  return `tool:${recovery.toolName}`;
}

function toolExecutionArguments(
  arguments_: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(arguments_).filter(([key]) => key !== RECOVERY_ARGUMENT_KEY),
  );
}

function stableJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(normalizeForStableJson(value, new WeakSet<object>()));
  } catch {
    return undefined;
  }
}

function normalizeForStableJson(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") throw new TypeError("non-JSON value");
  if (ancestors.has(value)) throw new TypeError("cyclic tool arguments");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeForStableJson(entry, ancestors));
    }
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("non-JSON tool arguments");
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForStableJson(entry, ancestors)]),
    );
  } finally {
    ancestors.delete(value);
  }
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null
    ? (value as Record<string, unknown>)
    : undefined;
}

function detachedBoundaryValue(value: unknown, source: string): unknown {
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError(`${source} returned a non-cloneable result.`);
  }
}

function requireHistoryMessages(value: unknown): LlmMessage[] {
  const detached = detachedBoundaryValue(value, "AgentLoopHistory messages");
  if (!Array.isArray(detached)) throw new TypeError("AgentLoopHistory messages must be an array.");
  return detached.map((entry) => {
    const message = recordValue(entry);
    if (message === undefined || typeof message["content"] !== "string") {
      throw new TypeError("AgentLoopHistory contains an invalid message.");
    }
    const role = message["role"];
    if (role === "system" || role === "user") {
      return { role, content: message["content"] };
    }
    if (role === "tool") {
      if (typeof message["toolCallId"] !== "string" || message["toolCallId"] === "") {
        throw new TypeError("AgentLoopHistory contains an invalid tool result.");
      }
      return { role, toolCallId: message["toolCallId"], content: message["content"] };
    }
    if (role !== "assistant") {
      throw new TypeError("AgentLoopHistory contains an unknown message role.");
    }
    const rawCalls = message["toolCalls"];
    if (rawCalls === undefined) return { role, content: message["content"] };
    if (!Array.isArray(rawCalls)) {
      throw new TypeError("AgentLoopHistory assistant toolCalls must be an array.");
    }
    const ids = new Set<string>();
    const toolCalls = rawCalls.map((entry_) => {
      const call = recordValue(entry_);
      if (
        call === undefined ||
        typeof call["id"] !== "string" ||
        call["id"] === "" ||
        ids.has(call["id"]) ||
        typeof call["name"] !== "string" ||
        call["name"] === "" ||
        typeof call["arguments"] !== "string"
      ) {
        throw new TypeError("AgentLoopHistory contains an invalid assistant tool call.");
      }
      let parsedArguments: unknown;
      try {
        parsedArguments = JSON.parse(call["arguments"]);
      } catch {
        throw new TypeError("AgentLoopHistory contains invalid tool-call JSON.");
      }
      if (recordValue(parsedArguments) === undefined || !isJsonValue(parsedArguments)) {
        throw new TypeError("AgentLoopHistory tool-call arguments must be a JSON object.");
      }
      ids.add(call["id"]);
      return { id: call["id"], name: call["name"], arguments: call["arguments"] };
    });
    return { role, content: message["content"], toolCalls };
  });
}

function requirePendingToolObservations(value: unknown): ToolObservationRecovery[] {
  const detached = detachedBoundaryValue(value, "AgentLoopHistory pending observations");
  if (!Array.isArray(detached)) {
    throw new TypeError("AgentLoopHistory pending observations must be an array.");
  }
  const identities = new Set<string>();
  return detached.map((entry) => {
    const record = recordValue(entry);
    const recovery = record === undefined ? undefined : parseToolObservationRecovery(record);
    if (recovery === undefined) {
      throw new TypeError("AgentLoopHistory contains an invalid pending observation identity.");
    }
    const identity = externalObservationKey(
      receiptToolName(recovery),
      recovery.originalToolCallId,
      recovery.outputRef,
    );
    if (identities.has(identity)) {
      throw new TypeError("AgentLoopHistory contains a duplicate pending observation identity.");
    }
    identities.add(identity);
    return recovery;
  });
}

export function requireAgentLoopHistory(value: unknown): AgentLoopHistory {
  const detached = detachedBoundaryValue(value, "AgentLoopHistory");
  const record = recordValue(detached);
  if (record === undefined) throw new TypeError("AgentLoopHistory must be an object.");
  return {
    messages: requireHistoryMessages(record["messages"]),
    pendingToolObservations: requirePendingToolObservations(record["pendingToolObservations"]),
  };
}

function requireMutableHistoryTarget(history: AgentLoopHistory): void {
  try {
    if (
      !Array.isArray(history.messages) ||
      !Array.isArray(history.pendingToolObservations) ||
      !Object.isExtensible(history.messages) ||
      !Object.isExtensible(history.pendingToolObservations)
    ) {
      throw new TypeError("AgentLoopHistory arrays must be mutable and extensible.");
    }
    // Exercise the exact mutation primitive used by persistence without
    // changing the caller's contents. This catches frozen arrays and common
    // fail-closed proxy targets before perception, LLM, or tool side effects.
    history.messages.splice(history.messages.length, 0);
    history.pendingToolObservations.splice(history.pendingToolObservations.length, 0);
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith("AgentLoopHistory arrays")) {
      throw error;
    }
    throw new TypeError(
      `AgentLoopHistory is not writable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function isJsonValue(value: unknown, ancestors = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry, ancestors));
    const record = recordValue(value);
    return (
      record !== undefined && Object.values(record).every((entry) => isJsonValue(entry, ancestors))
    );
  } finally {
    ancestors.delete(value);
  }
}

function requirePerception(value: unknown): {
  worldSummary: string;
  recentObservations: string;
  headRef: string | undefined;
  epochId?: string | undefined;
  participantCount?: number | undefined;
  artifactCount?: number | undefined;
  auditTailLength?: number | undefined;
} {
  const record = recordValue(detachedBoundaryValue(value, "Syscall perceive"));
  if (
    record === undefined ||
    typeof record["worldSummary"] !== "string" ||
    typeof record["recentObservations"] !== "string"
  ) {
    throw new TypeError("Syscall perceive returned an invalid result.");
  }
  const headRef = record["headRef"];
  return {
    worldSummary: record["worldSummary"],
    recentObservations: record["recentObservations"],
    headRef: typeof headRef === "string" ? headRef : undefined,
    ...(typeof record["epochId"] === "string" ? { epochId: record["epochId"] } : {}),
    ...(typeof record["participantCount"] === "number" ? { participantCount: record["participantCount"] } : {}),
    ...(typeof record["artifactCount"] === "number" ? { artifactCount: record["artifactCount"] } : {}),
    ...(typeof record["auditTailLength"] === "number" ? { auditTailLength: record["auditTailLength"] } : {}),
  };
}

function requireActions(value: unknown): ActionSchema[] {
  const detached = detachedBoundaryValue(value, "Syscall availableActions");
  if (!Array.isArray(detached)) {
    throw new TypeError("Syscall availableActions returned a non-array.");
  }
  return detached.map((entry) => {
    const record = recordValue(entry);
    const parameters = recordValue(record?.["parameters"]);
    if (
      record === undefined ||
      typeof record["name"] !== "string" ||
      record["name"] === "" ||
      typeof record["description"] !== "string" ||
      parameters === undefined ||
      !isJsonValue(parameters)
    ) {
      throw new TypeError("Syscall availableActions returned an invalid action schema.");
    }
    const clonedParameters = normalizeForStableJson(parameters, new WeakSet<object>());
    return {
      name: record["name"],
      description: record["description"],
      parameters: clonedParameters as Record<string, unknown>,
    };
  });
}

function requireLlmResponse(value: unknown): LlmChatResponse {
  const record = recordValue(detachedBoundaryValue(value, "LLM adapter"));
  const finishReasons = new Set(["stop", "tool_calls", "length", "error"]);
  if (
    record === undefined ||
    (record["text"] !== undefined && typeof record["text"] !== "string") ||
    !Array.isArray(record["toolCalls"]) ||
    typeof record["finishReason"] !== "string" ||
    !finishReasons.has(record["finishReason"])
  ) {
    throw new TypeError("LLM adapter returned an invalid response.");
  }

  const ids = new Set<string>();
  const toolCalls = record["toolCalls"].map((entry) => {
    const call = recordValue(entry);
    const args = recordValue(call?.["arguments"]);
    if (
      call === undefined ||
      typeof call["id"] !== "string" ||
      call["id"] === "" ||
      ids.has(call["id"]) ||
      typeof call["name"] !== "string" ||
      call["name"] === "" ||
      args === undefined ||
      !isJsonValue(args)
    ) {
      throw new TypeError("LLM adapter returned an invalid or duplicate tool call.");
    }
    ids.add(call["id"]);
    const clonedArguments = normalizeForStableJson(args, new WeakSet<object>());
    return {
      id: call["id"],
      name: call["name"],
      arguments: clonedArguments as Record<string, unknown>,
    };
  });

  const usage = requireTokenUsage(record["usage"]);
  const finishReason = record["finishReason"] as LlmChatResponse["finishReason"];
  if (
    (toolCalls.length > 0 && finishReason !== "tool_calls") ||
    (toolCalls.length === 0 && finishReason === "tool_calls")
  ) {
    throw new TypeError("LLM adapter returned inconsistent tool calls and finish reason.");
  }
  return {
    text: typeof record["text"] === "string" ? record["text"] : undefined,
    toolCalls,
    finishReason,
    ...(usage === undefined ? {} : { usage }),
  };
}

function requireTokenUsage(value: unknown): LlmChatResponse["usage"] {
  if (value === undefined) return undefined;
  const record = recordValue(value);
  if (record === undefined) throw new TypeError("LLM adapter returned invalid token usage.");
  const prompt = record["prompt"];
  const completion = record["completion"];
  const total = record["total"];
  if (
    typeof prompt !== "number" ||
    !Number.isFinite(prompt) ||
    prompt < 0 ||
    typeof completion !== "number" ||
    !Number.isFinite(completion) ||
    completion < 0 ||
    typeof total !== "number" ||
    !Number.isFinite(total) ||
    total < 0
  ) {
    throw new TypeError("LLM adapter returned invalid token usage.");
  }
  return { prompt, completion, total };
}

interface TurnRequestContext {
  readonly turns: number;
  readonly startTime: number;
  readonly producedRefs: ContentRef[];
  readonly ledger: OperationLedger;
  readonly options: RunOptions | undefined;
  readonly maxTimeMs: number;
}

function isolateRunObservers(options: RunOptions | undefined): RunOptions | undefined {
  if (options === undefined) return undefined;
  const observer = options.onEvent;
  const progressObserver = options.onProgress;
  return {
    ...options,
    ...(observer === undefined
      ? {}
      : {
          onEvent: (event: AgentEvent) => {
            try {
              ignoreObserverResult(
                (observer as (event: AgentEvent) => unknown)(structuredClone(event)),
              );
            } catch {
              // Observability is not an execution authority. A broken callback
              // cannot mutate internal tool calls or interrupt side effects.
            }
          },
        }),
    ...(progressObserver === undefined
      ? {}
      : {
          onProgress: (event: Parameters<NonNullable<RunOptions["onProgress"]>>[0]) => {
            try {
              ignoreObserverResult(
                (
                  progressObserver as (
                    event: Parameters<NonNullable<RunOptions["onProgress"]>>[0],
                  ) => unknown
                )(structuredClone(event)),
              );
            } catch {
              // Progress rendering cannot change the run outcome.
            }
          },
        }),
  };
}

function ignoreObserverResult(result: unknown): void {
  try {
    void Promise.resolve(result).catch(() => undefined);
  } catch {
    // Even a hostile thenable is telemetry input, never execution authority.
  }
}

interface TurnPreparationContext extends TurnRequestContext {
  readonly syscall: Syscall;
  readonly messages: readonly LlmMessage[];
  readonly goalMessage: LlmMessage;
  readonly maxContext: number;
}

interface PreparedTurn {
  readonly messages: LlmMessage[];
  readonly messagesForLlm: readonly LlmMessage[];
  readonly tools: readonly LlmToolDef[];
}

async function prepareTurn(
  ctx: TurnPreparationContext,
): Promise<{ readonly prepared: PreparedTurn } | { readonly failure: RunResult }> {
  const emit = ctx.options?.onEvent;
  let contextMsg: string;
  try {
    const perception = requirePerception(await ctx.syscall.perceive());
    contextMsg = buildContextMessage(perception.worldSummary, perception.recentObservations);
  } catch (caught: unknown) {
    return {
      failure: phaseFailure(
        "perceive",
        caught,
        ctx.turns,
        ctx.startTime,
        ctx.producedRefs,
        ctx.ledger,
        emit,
      ),
    };
  }

  let actions: ActionSchema[];
  try {
    actions = requireActions(await ctx.syscall.availableActions());
  } catch (caught: unknown) {
    return {
      failure: phaseFailure(
        "available_actions",
        caught,
        ctx.turns,
        ctx.startTime,
        ctx.producedRefs,
        ctx.ledger,
        emit,
      ),
    };
  }

  // For very small budgets, the instruction hierarchy is: current goal,
  // canonical system prompt, then the per-turn world snapshot.
  const includeWorldContext = ctx.maxContext > 2;
  const messages = compactMessages(
    ctx.messages,
    ctx.maxContext - (includeWorldContext ? 1 : 0),
    ctx.goalMessage,
  );
  const messagesForLlm: LlmMessage[] = includeWorldContext
    ? [...messages, { role: "system", content: contextMsg }]
    : [...messages];
  return { prepared: { messages, messagesForLlm, tools: actionsToToolDefs(actions) } };
}

/**
 * One LLM call, with its start/delta/end events. A failure is returned as a
 * terminal RunResult rather than thrown, so the caller stays a flat loop.
 */
async function requestTurnResponse(
  llm: LlmAdapter,
  messagesForLlm: readonly LlmMessage[],
  tools: readonly LlmToolDef[],
  perTurnTimeout: number,
  ctx: TurnRequestContext,
): Promise<{ readonly response: LlmChatResponse } | { readonly failure: RunResult }> {
  const emit = ctx.options?.onEvent;
  emit?.({ kind: "llm_start", turn: ctx.turns });

  try {
    const response = requireLlmResponse(
      await callLlmWithTimeout(
        llm,
        messagesForLlm,
        tools,
        perTurnTimeout,
        ctx.options?.signal,
        emit === undefined
          ? undefined
          : (text) => {
              emit({ kind: "llm_delta", turn: ctx.turns, text });
            },
        emit === undefined
          ? undefined
          : (message, detail) => {
              emit({
                kind: "diagnostic",
                turn: ctx.turns,
                phase: "stream",
                message,
                ...(detail !== undefined ? { detail } : {}),
              });
            },
      ),
    );

    emit?.({
      kind: "llm_end",
      turn: ctx.turns,
      text: response.text ?? "",
      toolCalls: response.toolCalls,
      ...(response.usage !== undefined ? { usage: response.usage } : {}),
    });

    return { response };
  } catch (err: unknown) {
    return { failure: turnRequestFailure(err, ctx, emit) };
  }
}

function turnRequestFailure(
  caught: unknown,
  ctx: TurnRequestContext,
  emit?: (event: AgentEvent) => void,
): RunResult {
  if (caught instanceof AgentLoopAbortError) {
    return mkResult(
      false,
      "Run aborted by caller.",
      ctx.turns,
      ctx.startTime,
      ctx.producedRefs,
      "aborted",
      ctx.ledger,
    );
  }
  if (caught instanceof AgentLoopTimeoutError) {
    const error: RunError = { phase: "llm", message: caught.message, retryable: true };
    emit?.({ kind: "error", turn: ctx.turns, ...error });
    return mkResult(
      false,
      caught.message,
      ctx.turns,
      ctx.startTime,
      ctx.producedRefs,
      "error",
      ctx.ledger,
      error,
    );
  }
  if (Date.now() - ctx.startTime >= ctx.maxTimeMs) {
    return mkResult(
      false,
      `Time limit exceeded (${ctx.maxTimeMs}ms).`,
      ctx.turns,
      ctx.startTime,
      ctx.producedRefs,
      "max_time",
      ctx.ledger,
    );
  }
  const message = caught instanceof Error ? caught.message : String(caught);
  // An error thrown with a `detail` string (e.g. a stream or adapter failure
  // that named the offending frame/field) is surfaced verbatim so the user can
  // locate the fault without verbose logging.
  const detail =
    caught instanceof Error &&
    typeof (caught as unknown as { detail?: unknown }).detail === "string"
      ? (caught as unknown as { detail: string }).detail
      : undefined;
  const error: RunError = { phase: "llm", message, retryable: false };
  emit?.({
    kind: "error",
    turn: ctx.turns,
    ...error,
    ...(detail !== undefined ? { detail } : {}),
  });
  return mkResult(
    false,
    `LLM error: ${message}`,
    ctx.turns,
    ctx.startTime,
    ctx.producedRefs,
    "error",
    ctx.ledger,
    error,
  );
}

/**
 * The agent loop: while (!done) { perceive → LLM → execute tool_calls → repeat }.
 *
 * Safety:
 * - Checks abort signal, turn count, and time limit BEFORE each LLM call
 * - LLM calls have a per-turn timeout (AbortController)
 * - Messages array is compacted in-place to bound memory
 * - The ONLY legitimate completion signal is the "done" tool call
 * - finishReason "stop" is NOT completion — LLM may just be thinking
 */
export async function runAgentLoop(
  syscall: Syscall,
  llm: LlmAdapter,
  instruction: string,
  terminationController: TerminationController,
  config?: Partial<AgentLoopConfig>,
  options?: RunOptions,
): Promise<RunResult> {
  options = isolateRunObservers(options);
  const maxTurns = config?.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxTimeMs = config?.maxTimeMs ?? DEFAULT_MAX_TIME_MS;
  const maxContext = config?.maxContextMessages ?? DEFAULT_MAX_CONTEXT_MESSAGES;
  const perTurnTimeout = config?.perTurnTimeoutMs ?? DEFAULT_PER_TURN_TIMEOUT_MS;

  const startTime = Date.now();
  const systemPrompt = config?.systemPrompt ?? buildDefaultSystemPrompt(config?.actorId);
  const goalMessage = { role: "user" as const, content: instruction };
  const preflightConfigurationError = validateAgentLoopLimits({
    maxTurns,
    maxTimeMs,
    maxContext,
    perTurnTimeout,
  });
  if (preflightConfigurationError !== undefined) {
    return preflightConfigurationFailure(preflightConfigurationError, options, startTime);
  }
  const initialized = initializeAgentLoopState(
    config,
    options,
    systemPrompt,
    goalMessage,
    startTime,
  );
  if ("failure" in initialized) return initialized.failure;
  const state = initialized.state;

  // Compile (and freeze) the goal contract once, before the first turn. The
  // controller owns termination; the LLM only drafts the contract. Failure to
  // draft falls back to the system default contract — never a hard abort.
  let contract: GoalContract;
  try {
    contract = await terminationController.compileContract(instruction);
  } catch {
    contract = defaultSystemContract(instruction, new Date().toISOString());
  }

  const ctx: AgentLoopExecutionContext = {
    syscall,
    llm,
    terminationController,
    contract,
    options,
    maxTurns,
    maxTimeMs,
    maxContext,
    perTurnTimeout,
    startTime,
    goalMessage,
    state,
    ...(config?.onHistoryCheckpoint === undefined
      ? {}
      : { onHistoryCheckpoint: config.onHistoryCheckpoint }),
  };
  const result = await executeAgentLoop(ctx);
  if (!state.historyPersistenceFailed && state.historyDirty) {
    const persistenceError = persistAgentLoopHistory(state);
    if (persistenceError !== undefined) return historyPersistenceFailure(ctx, persistenceError);
  }
  return result;
}

interface MutableAgentLoopState {
  messages: LlmMessage[];
  /**
   * Exact validated evidence retained independently from the bounded provider
   * context. Unlike `messages`, this transcript is never compacted merely to
   * satisfy an LLM request budget.
   */
  evidenceMessages: LlmMessage[];
  readonly producedRefs: ContentRef[];
  readonly ledger: OperationLedger;
  readonly history: AgentLoopHistory | undefined;
  historyDirty: boolean;
  historyPersistenceFailed: boolean;
  turns: number;
  /**
   * First-class turn accumulators for the termination controller's no-progress
   * verifiers. Accumulated at the end of each turn from real output — never
   * lazily recomputed — so the controller reads stable, monotonic counts.
   */
  plainTextTurns: number;
  toolCallTurns: number;
  recentAssistantTexts: string[];
}

function initializeAgentLoopState(
  config: Partial<AgentLoopConfig> | undefined,
  options: RunOptions | undefined,
  systemPrompt: string,
  goalMessage: LlmMessage,
  startTime: number,
): { readonly state: MutableAgentLoopState } | { readonly failure: RunResult } {
  const producedRefs: ContentRef[] = [];
  let ledger = new OperationLedger();
  try {
    const history = options?.history ?? config?.history;
    if (config?.onHistoryCheckpoint !== undefined && history === undefined) {
      throw new TypeError("onHistoryCheckpoint requires a reusable AgentLoopHistory instance.");
    }
    const restoredHistory = history === undefined ? undefined : requireAgentLoopHistory(history);
    if (history !== undefined) requireMutableHistoryTarget(history);
    const pending = restoredHistory?.pendingToolObservations ?? [];
    ledger = new OperationLedger(pending);
    const historyMessages = restoredHistory?.messages ?? [];
    const initialMessages = requireHistoryMessages(config?.initialMessages ?? []);
    const seed = historyMessages.length > 0 ? historyMessages : initialMessages;
    const evidenceMessages = initializeMessages(seed, systemPrompt);
    const messages = evidenceMessages.map((message) => cloneMessage(message));
    messages.push(goalMessage);
    evidenceMessages.push(goalMessage);
    return {
      state: {
        messages,
        evidenceMessages,
        producedRefs,
        ledger,
        history,
        historyDirty: history !== undefined,
        historyPersistenceFailed: false,
        turns: 0,
        plainTextTurns: 0,
        toolCallTurns: 0,
        recentAssistantTexts: [],
      },
    };
  } catch (caught: unknown) {
    return {
      failure: phaseFailure(
        "configuration",
        caught,
        0,
        startTime,
        producedRefs,
        ledger,
        options?.onEvent,
      ),
    };
  }
}

interface AgentLoopExecutionContext {
  readonly syscall: Syscall;
  readonly llm: LlmAdapter;
  readonly terminationController: TerminationController;
  readonly contract: GoalContract;
  readonly options: RunOptions | undefined;
  readonly maxTurns: number;
  readonly maxTimeMs: number;
  readonly maxContext: number;
  readonly perTurnTimeout: number;
  readonly startTime: number;
  readonly goalMessage: LlmMessage;
  readonly state: MutableAgentLoopState;
  readonly onHistoryCheckpoint?: (history: AgentLoopHistory) => void | Promise<void>;
}

async function executeAgentLoop(ctx: AgentLoopExecutionContext): Promise<RunResult> {
  while (true) {
    const terminal = await executeAgentTurn(ctx);
    if (terminal !== undefined) return terminal;
  }
}

function preflightConfigurationFailure(
  message: string,
  options: RunOptions | undefined,
  startTime: number,
): RunResult {
  const error: RunError = { phase: "configuration", message, retryable: false };
  options?.onEvent?.({ kind: "error", turn: 0, ...error });
  return {
    ok: false,
    summary: message,
    turns: 0,
    elapsedMs: Date.now() - startTime,
    producedRefs: [],
    terminationReason: "error",
    operations: { committed: 0, rejected: 0 },
    toolCalls: { total: 0, succeeded: 0, failed: 0, unresolved: 0 },
    error,
  };
}

async function executeAgentTurn(ctx: AgentLoopExecutionContext): Promise<RunResult | undefined> {
  const state = ctx.state;
  const limitResult = checkRunLimits(
    ctx.options,
    ctx.maxTimeMs,
    ctx.maxTurns,
    state.turns,
    ctx.startTime,
    state.producedRefs,
    state.ledger,
  );
  if (limitResult !== undefined) return limitResult;
  const preTurnContextFailure = ensureLatestToolGroupFitsContext(ctx);
  if (preTurnContextFailure !== undefined) return preTurnContextFailure;

  state.turns++;
  ctx.options?.onEvent?.({
    kind: "turn_start",
    turn: state.turns,
    elapsedMs: Date.now() - ctx.startTime,
  });
  const turnPreparation = await prepareTurn({
    syscall: ctx.syscall,
    messages: state.messages,
    goalMessage: ctx.goalMessage,
    maxContext: ctx.maxContext,
    turns: state.turns,
    startTime: ctx.startTime,
    producedRefs: state.producedRefs,
    ledger: state.ledger,
    options: ctx.options,
    maxTimeMs: ctx.maxTimeMs,
  });
  if ("failure" in turnPreparation) return turnPreparation.failure;
  state.messages = turnPreparation.prepared.messages;

  // Perception and action discovery may consume the remaining budget or abort
  // the run. Never initiate a fresh LLM request after either condition.
  const postPreparationLimit = checkRunLimits(
    ctx.options,
    ctx.maxTimeMs,
    ctx.maxTurns,
    state.turns - 1,
    ctx.startTime,
    state.producedRefs,
    state.ledger,
  );
  if (postPreparationLimit !== undefined) return postPreparationLimit;

  const turnResponse = await requestTurnResponse(
    ctx.llm,
    turnPreparation.prepared.messagesForLlm,
    turnPreparation.prepared.tools,
    Math.max(1, Math.min(ctx.perTurnTimeout, ctx.maxTimeMs - (Date.now() - ctx.startTime))),
    {
      turns: state.turns,
      startTime: ctx.startTime,
      producedRefs: state.producedRefs,
      ledger: state.ledger,
      options: ctx.options,
      maxTimeMs: ctx.maxTimeMs,
    },
  );
  if ("failure" in turnResponse) return turnResponse.failure;
  const postLlmLimit = checkRunLimits(
    ctx.options,
    ctx.maxTimeMs,
    ctx.maxTurns,
    state.turns - 1,
    ctx.startTime,
    state.producedRefs,
    state.ledger,
  );
  if (postLlmLimit !== undefined) return postLlmLimit;

  const turnMessageCount = state.messages.length;
  const turnOutcome = await processTurnResponse(
    ctx,
    turnResponse.response,
    state.messages,
  );
  // processTurnResponse mutates this exact array even on terminal outcomes, so
  // retain it before checkpointing terminal tool groups (including unresolved
  // external-observation receipts).
  state.messages = "messages" in turnOutcome ? turnOutcome.messages : state.messages;
  state.evidenceMessages.push(
    ...state.messages.slice(turnMessageCount).map((message) => cloneMessage(message)),
  );
  state.historyDirty = state.history !== undefined;
  const persistenceError = persistAgentLoopHistory(state);
  if (persistenceError !== undefined) return historyPersistenceFailure(ctx, persistenceError);
  const checkpointFailure = await checkpointAgentLoopHistory(ctx);
  if (checkpointFailure !== undefined) return checkpointFailure;
  if ("result" in turnOutcome) return turnOutcome.result;
  const contextFailure = ensureLatestToolGroupFitsContext(ctx);
  if (contextFailure !== undefined) return contextFailure;
  return undefined;
}

async function checkpointAgentLoopHistory(
  ctx: AgentLoopExecutionContext,
): Promise<RunResult | undefined> {
  if (ctx.onHistoryCheckpoint === undefined || ctx.state.history === undefined) return undefined;
  try {
    await ctx.onHistoryCheckpoint(requireAgentLoopHistory(ctx.state.history));
    return undefined;
  } catch (caught: unknown) {
    return phaseFailure(
      "tool",
      new Error(
        `Private history checkpoint failed: ${caught instanceof Error ? caught.message : String(caught)}`,
      ),
      ctx.state.turns,
      ctx.startTime,
      ctx.state.producedRefs,
      ctx.state.ledger,
      ctx.options?.onEvent,
    );
  }
}

function persistAgentLoopHistory(state: MutableAgentLoopState): Error | undefined {
  if (state.history === undefined || !state.historyDirty) return undefined;
  try {
    const retained = normalizeHistoryMessages(state.evidenceMessages);
    state.history.messages.splice(0, state.history.messages.length, ...retained);
    state.history.pendingToolObservations.splice(
      0,
      state.history.pendingToolObservations.length,
      ...state.ledger.pendingToolObservations(),
    );
    state.historyDirty = false;
    return undefined;
  } catch (error) {
    state.historyPersistenceFailed = true;
    return new Error(
      `Private history synchronization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function historyPersistenceFailure(ctx: AgentLoopExecutionContext, error: Error): RunResult {
  return phaseFailure(
    "tool",
    error,
    ctx.state.turns,
    ctx.startTime,
    ctx.state.producedRefs,
    ctx.state.ledger,
    ctx.options?.onEvent,
  );
}

function latestToolGroup(messages: readonly LlmMessage[]): readonly LlmMessage[] | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== "assistant" || (message.toolCalls?.length ?? 0) === 0) continue;
    const calls = message.toolCalls ?? [];
    const results = messages.slice(index + 1, index + 1 + calls.length);
    if (
      results.length === calls.length &&
      results.every(
        (result, resultIndex) =>
          result.role === "tool" && result.toolCallId === calls[resultIndex]?.id,
      )
    ) {
      return [message, ...results];
    }
  }
  return undefined;
}

function ensureLatestToolGroupFitsContext(ctx: AgentLoopExecutionContext): RunResult | undefined {
  const group = latestToolGroup(ctx.state.messages);
  if (group === undefined) return undefined;
  const contextBudget = ctx.maxContext - (ctx.maxContext > 2 ? 1 : 0);
  const nextContext = compactMessages(ctx.state.messages, contextBudget, ctx.goalMessage);
  if (group.every((message) => nextContext.includes(message))) return undefined;
  const message =
    `maxContextMessages=${String(ctx.maxContext)} cannot retain the latest complete tool group ` +
    `(${String(group.length)} messages) together with the required provider context.`;
  const error: RunError = { phase: "configuration", message, retryable: false };
  ctx.options?.onEvent?.({
    kind: "error",
    turn: ctx.state.turns,
    phase: "configuration",
    message,
    retryable: false,
  });
  return mkResult(
    false,
    message,
    ctx.state.turns,
    ctx.startTime,
    ctx.state.producedRefs,
    "error",
    ctx.state.ledger,
    error,
  );
}

export function validateAgentLoopLimits(input: {
  readonly maxTurns: number;
  readonly maxTimeMs: number;
  readonly maxContext: number;
  readonly perTurnTimeout: number;
}): string | undefined {
  if (!Number.isInteger(input.maxTurns) || input.maxTurns < 1) {
    return "maxTurns must be a positive integer.";
  }
  if (!Number.isFinite(input.maxTimeMs) || input.maxTimeMs <= 0) {
    return "maxTimeMs must be a positive finite number.";
  }
  if (!Number.isInteger(input.maxContext) || input.maxContext < 1) {
    return "maxContextMessages must be a positive integer.";
  }
  if (!Number.isFinite(input.perTurnTimeout) || input.perTurnTimeout <= 0) {
    return "perTurnTimeoutMs must be a positive finite number.";
  }
  return undefined;
}

function phaseFailure(
  phase: AgentErrorPhase,
  caught: unknown,
  turns: number,
  startTime: number,
  producedRefs: readonly ContentRef[],
  ledger: OperationLedger,
  emit?: (event: AgentEvent) => void,
): RunResult {
  const message = caught instanceof Error ? caught.message : String(caught);
  const error: RunError = { phase, message, retryable: false };
  emit?.({ kind: "error", turn: turns, ...error });
  return mkResult(
    false,
    `${phaseLabel(phase)} error: ${message}`,
    turns,
    startTime,
    producedRefs,
    "error",
    ledger,
    error,
  );
}

function phaseLabel(phase: AgentErrorPhase): string {
  switch (phase) {
    case "available_actions":
      return "Available actions";
    case "configuration":
      return "Configuration";
    case "llm":
      return "LLM";
    case "perceive":
      return "Perceive";
    case "tool":
      return "Tool";
  }
}

/** Sentinel: the tool group ended with a `done` call that the controller must review. */
interface DoneSignal {
  readonly doneSignaled: true;
  readonly summary: string;
}

/** Result of executing a response's tool calls: terminal, a done signal, or continue. */
type ToolRunOutcome = RunResult | DoneSignal | undefined;

async function processTurnResponse(
  ctx: AgentLoopExecutionContext,
  response: LlmChatResponse,
  messages: LlmMessage[],
): Promise<{ result: RunResult } | { messages: LlmMessage[] }> {
  const elapsedMs = Date.now() - ctx.startTime;

  // Highest priority: hard runtime faults are not the controller's call. A
  // truncated or errored response, or an exhausted wall-clock budget, terminates
  // immediately regardless of the controller's verdict. The controller judges
  // goal completion; it never overrides an unambiguous runtime failure.
  if (
    response.finishReason === "error" ||
    response.finishReason === "length" ||
    elapsedMs >= ctx.maxTimeMs
  ) {
    const reason: TerminationReason =
      response.finishReason === "error" || response.finishReason === "length"
        ? "error"
        : "max_time";
    if (response.toolCalls.length === 0 && response.text !== undefined) {
      messages.push({ role: "assistant", content: response.text });
    }
    const summary = response.text ?? `Terminated: ${reason}`;
    return {
      result: settleRun(
        false,
        summary,
        ctx.state.turns,
        ctx.startTime,
        ctx.state.producedRefs,
        reason,
        ctx.state.ledger,
      ),
    };
  }

  if (response.toolCalls.length === 0) {
    messages.push({ role: "assistant", content: response.text ?? "" });
    accumulateTrace(ctx.state, response, "text");
    ctx.options?.onProgress?.({
      turn: ctx.state.turns,
      elapsedMs: Date.now() - ctx.startTime,
      lastAction: "text_response",
    });
    ctx.options?.onEvent?.({
      kind: "turn_end",
      turn: ctx.state.turns,
      elapsedMs: Date.now() - ctx.startTime,
      lastAction: "text_response",
    });
    // The controller now owns termination even for plain-text turns: a "stop"
    // with no tool calls is no longer an unconditional continue. If the goal is
    // satisfied (or stalled), the controller verdicts DONE/STALLED here.
    const evaluation = await evaluateController(ctx, response, false);
    if ("fault" in evaluation) return { result: evaluation.fault };
    return dispatchControlVerdict(ctx, evaluation, messages, response);
  }

  const orderedToolCalls = orderToolCallsForExecution(response.toolCalls);
  messages.push({
    role: "assistant",
    content: response.text ?? "",
    toolCalls: orderedToolCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
    })),
  });

  const toolRunResult = await executeToolCalls(
    ctx.syscall,
    orderedToolCalls,
    messages,
    ctx.state.producedRefs,
    ctx.state.ledger,
    ctx.state.turns,
    ctx.startTime,
    ctx.maxTimeMs,
    ctx.options,
  );
  if (toolRunResult !== undefined && !("doneSignaled" in toolRunResult)) {
    return { result: toolRunResult };
  }
  accumulateTrace(ctx.state, response, "tool");

  const lastAction = orderedToolCalls.at(-1)?.name ?? "unknown";
  ctx.options?.onProgress?.({
    turn: ctx.state.turns,
    elapsedMs: Date.now() - ctx.startTime,
    lastAction,
  });
  ctx.options?.onEvent?.({
    kind: "turn_end",
    turn: ctx.state.turns,
    elapsedMs: Date.now() - ctx.startTime,
    lastAction,
  });

  // A `done` call is now an advisory signal, not a termination. The controller
  // reviews the full state: if the goal is truly met it verdicts DONE; if the
  // model declared done without evidence it verdicts VERIFY and the loop
  // continues to gather that evidence.
  if (toolRunResult !== undefined && toolRunResult.doneSignaled) {
    const evaluation = await evaluateController(ctx, response, true);
    if ("fault" in evaluation) return { result: evaluation.fault };
    return dispatchControlVerdict(ctx, evaluation, messages, response, toolRunResult.summary);
  }
  return { messages };
}

/**
 * Accumulate first-class trace state for the controller's no-progress verifiers.
 * Called once per turn from real output — never recomputed lazily.
 */
function accumulateTrace(
  state: MutableAgentLoopState,
  response: LlmChatResponse,
  kind: "text" | "tool",
): void {
  if (kind === "text") state.plainTextTurns++;
  else state.toolCallTurns++;
  const text = response.text ?? "";
  if (text !== "") {
    state.recentAssistantTexts.push(text);
    if (state.recentAssistantTexts.length > 8) state.recentAssistantTexts.shift();
  }
}

/**
 * Build the full agent state `x_t` and ask the termination controller for a
 * verdict. Perceives the world fresh at the end of the turn — after any tool
 * side effects — so the controller judges the world the actions produced, not
 * the world the turn started in. A perception failure is a hard runtime fault:
 * it is surfaced as a terminal perceive-phase error rather than a guessed
 * verdict, consistent with how prepareTurn treats perceive failures.
 */
async function evaluateController(
  ctx: AgentLoopExecutionContext,
  response: LlmChatResponse,
  llmDoneSignal: boolean,
): Promise<ControlVerdict | { readonly fault: RunResult }> {
  const state = ctx.state;
  let perception: { worldSummary: string; recentObservations: string; headRef: string | undefined; epochId?: string | undefined; participantCount?: number | undefined; artifactCount?: number | undefined; auditTailLength?: number | undefined };
  try {
    perception = requirePerception(await ctx.syscall.perceive());
  } catch (caught: unknown) {
    // Cannot judge a world we cannot read. Surface a structured perceive-phase
    // fault so the caller turns it into a terminal result rather than guessing.
    return {
      fault: phaseFailure(
        "perceive",
        caught,
        state.turns,
        ctx.startTime,
        state.producedRefs,
        state.ledger,
        ctx.options?.onEvent,
      ),
    };
  }

  const world: WorldSnapshot = {
    worldSummary: perception.worldSummary,
    headRef: perception.headRef,
    epochId: perception.epochId,
    participantCount: perception.participantCount ?? 0,
    artifactCount: perception.artifactCount ?? 0,
    auditTailLength: perception.auditTailLength ?? 0,
  };

  const tally = state.ledger.operationTally;
  const traceCounts: TraceCounts = {
    conversationTurns: state.turns,
    plainTextTurns: state.plainTextTurns,
    toolCallTurns: state.toolCallTurns,
    recentAssistantTexts: state.recentAssistantTexts,
    committedOperations: tally.committed,
    rejectedOperations: tally.rejected,
  };

  const agentState = collectAgentState({
    world,
    traceCounts,
    produce: {
      artifactIds: [],
      contentRefs: state.producedRefs.map((ref) => String(ref)),
    },
    messages: state.evidenceMessages,
    pendingReply: { text: response.text ?? "", hasToolCalls: response.toolCalls.length > 0 },
  });

  // Candidate actions derive from the current action schema. A text-only
  // candidate is always offered so the controller can value "reply to user" as a
  // continuation; coordination/tool candidates come from availableActions.
  const candidateActions: CandidateAction[] = [{ name: "reply", kind: "text" }];
  try {
    const actions = requireActions(await ctx.syscall.availableActions());
    for (const action of actions) {
      const kind = isCoordinationToolCall(action.name) ? "coordination" : "tool";
      candidateActions.push({ name: action.name, kind });
    }
  } catch {
    // Available-action discovery is best-effort for VOC; a failure here must not
    // block a termination judgment. Continue with the text candidate only.
  }

  try {
    return await ctx.terminationController.evaluateTurn({
      contract: ctx.contract,
      state: agentState,
      candidateActions,
      llmDoneSignal,
    });
  } catch (caught: unknown) {
    // A controller that throws (bad verifier, misconfigured embedder, etc.) must
    // not crash the loop. Surface it as a configuration-phase fault so the run
    // terminates with an auditable error rather than an unhandled rejection.
    return {
      fault: phaseFailure(
        "configuration",
        caught,
        state.turns,
        ctx.startTime,
        state.producedRefs,
        state.ledger,
        ctx.options?.onEvent,
      ),
    };
  }
}

/**
 * Act on a controller verdict: terminal verdicts (DONE/STALLED) end the run;
 * continuation verdicts (CONTINUE/VERIFY/REPLAN) loop; ASK_USER pauses for a
 * human answer or, with no ask handler, degrades to STALLED.
 */
async function dispatchControlVerdict(
  ctx: AgentLoopExecutionContext,
  verdict: ControlVerdict,
  messages: LlmMessage[],
  response: LlmChatResponse,
  doneSummary?: string,
): Promise<{ result: RunResult } | { messages: LlmMessage[] }> {
  const state = ctx.state;
  ctx.options?.onEvent?.({
    kind: "control_verdict",
    turn: state.turns,
    verdict,
  });

  switch (verdict.kind) {
    case "DONE": {
      const summary = doneSummary ?? response.text ?? "Goal complete.";
      return {
        result: settleRun(
          true,
          summary,
          state.turns,
          ctx.startTime,
          state.producedRefs,
          "controller",
          state.ledger,
        ),
      };
    }
    case "STALLED": {
      return {
        result: settleRun(
          false,
          verdict.blocker,
          state.turns,
          ctx.startTime,
          state.producedRefs,
          "controller",
          state.ledger,
        ),
      };
    }
    case "ASK_USER": {
      if (ctx.options?.onAskUser === undefined) {
        // No one to ask — degrade to STALLED rather than spin silently.
        return {
          result: settleRun(
            false,
            `Stalled without a way to ask: ${verdict.question}`,
            state.turns,
            ctx.startTime,
            state.producedRefs,
            "controller",
            state.ledger,
          ),
        };
      }
      ctx.options.onEvent?.({
        kind: "ask_user",
        turn: state.turns,
        question: verdict.question,
        ...(verdict.options === undefined ? {} : { options: verdict.options }),
      });
      const answer = await ctx.options.onAskUser(verdict.question, verdict.options);
      messages.push({ role: "user", content: answer });
      return { messages };
    }
    case "CONTINUE":
    case "VERIFY":
    case "REPLAN":
      // All three continue the loop. VERIFY/REPLAN steer by verdict event alone
      // (P0); the model reads the control_verdict context from the transcript and
      // adjusts. No message injection is needed beyond what the turn already left.
      return { messages };
  }
}

/** Execute completion only after all substantive calls from the same response. */
function orderToolCallsForExecution(
  toolCalls: readonly LlmToolCallResult[],
): readonly LlmToolCallResult[] {
  if (toolCalls.length < 2 || toolCalls.at(-1)?.name === "done") return toolCalls;
  return [
    ...toolCalls.filter((toolCall) => toolCall.name !== "done"),
    ...toolCalls.filter((toolCall) => toolCall.name === "done"),
  ];
}

function checkRunLimits(
  options: RunOptions | undefined,
  maxTimeMs: number,
  maxTurns: number,
  turns: number,
  startTime: number,
  producedRefs: ContentRef[],
  ledger: OperationLedger,
): RunResult | undefined {
  if (options?.signal?.aborted) {
    return mkResult(
      false,
      "Run aborted by caller.",
      turns,
      startTime,
      producedRefs,
      "aborted",
      ledger,
    );
  }

  const elapsedMs = Date.now() - startTime;
  if (elapsedMs >= maxTimeMs) {
    return mkResult(
      false,
      `Time limit exceeded (${maxTimeMs}ms).`,
      turns,
      startTime,
      producedRefs,
      "max_time",
      ledger,
    );
  }
  if (turns >= maxTurns) {
    return mkResult(
      false,
      `Turn limit exceeded (${maxTurns}).`,
      turns,
      startTime,
      producedRefs,
      "max_turns",
      ledger,
    );
  }

  return undefined;
}

/**
 * Builds a terminal result, overriding a claimed success while any tool/target
 * failure is unresolved. A later success for the same key clears the unresolved
 * state but remains visible in the historical success/failure tally.
 */
function settleRun(
  ok: boolean,
  summary: string,
  turns: number,
  startTime: number,
  producedRefs: readonly ContentRef[],
  reason: TerminationReason,
  ledger: OperationLedger,
): RunResult {
  if (!ok || ledger.unresolvedCount === 0) {
    return mkResult(ok, summary, turns, startTime, producedRefs, reason, ledger);
  }
  const names = ledger.unresolvedTools.join(", ");
  const count = ledger.unresolvedCount;
  const operationTally = ledger.operationTally;
  const noCoordinationCommit =
    operationTally.rejected > 0 && operationTally.committed === 0
      ? " nothing was committed to the coordination world."
      : "";
  const message =
    `${String(count)} unresolved tool failure(s) remain` +
    (names === "" ? "." : ` (${names}).`) +
    noCoordinationCommit;
  const error: RunError = { phase: "tool", message, retryable: true };
  return mkResult(
    false,
    `${summary}\n\n[Run failed] ${message}`,
    turns,
    startTime,
    producedRefs,
    "error",
    ledger,
    error,
  );
}

async function executeToolCalls(
  syscall: Syscall,
  toolCalls: readonly LlmToolCallResult[],
  messages: LlmMessage[],
  producedRefs: ContentRef[],
  ledger: OperationLedger,
  turns: number,
  startTime: number,
  maxTimeMs: number,
  options?: RunOptions,
): Promise<ToolRunOutcome> {
  const ctx: ToolExecutionContext = {
    syscall,
    messages,
    producedRefs,
    ledger,
    turns,
    startTime,
    maxTimeMs,
    options,
  };
  const resultStart = messages.length;
  for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
    const toolCall = toolCalls[toolIndex];
    if (toolCall === undefined) continue;
    const outcome = await executeOneToolCall(ctx, toolCall, toolIndex === toolCalls.length - 1);
    if (outcome !== undefined) {
      if ("doneSignaled" in outcome) return outcome;
      completeTerminatedToolGroup(ctx, toolCalls, toolCall, resultStart);
      return refreshRunToolTally(outcome, ctx.ledger);
    }
  }

  return undefined;
}

/**
 * A provider response declares one atomic tool-result group. If execution
 * terminates partway through that group, append an explicit result for every
 * call that did not run. This makes the persisted provider transcript complete
 * without misrepresenting a skipped call as an executed side effect.
 *
 * This closes graceful abort/error/limit paths only. It deliberately does not
 * claim to close the process-crash window between two tool calls.
 */
function completeTerminatedToolGroup(
  ctx: ToolExecutionContext,
  toolCalls: readonly LlmToolCallResult[],
  terminalCall: LlmToolCallResult,
  resultStart: number,
): void {
  const completedIds = new Set(
    ctx.messages
      .slice(resultStart)
      .flatMap((message) =>
        message.role === "tool" && message.toolCallId !== undefined ? [message.toolCallId] : [],
      ),
  );
  for (const toolCall of toolCalls) {
    if (completedIds.has(toolCall.id)) continue;
    const output =
      `${SKIPPED_TOOL_RESULT_PREFIX} Execution stopped at tool call ` +
      `${terminalCall.id} (${terminalCall.name}) before ${toolCall.id} (${toolCall.name}) ran.`;
    // Skipped calls count as failed LLM-requested calls, but they were not
    // coordination attempts and cannot resolve or introduce ledger failures.
    ctx.ledger.record(toolCall, false, false, false);
    ctx.messages.push({ role: "tool", toolCallId: toolCall.id, content: output });
  }
}

function refreshRunToolTally(result: RunResult, ledger: OperationLedger): RunResult {
  return { ...result, operations: ledger.operationTally, toolCalls: ledger.toolTally };
}

interface ToolExecutionContext {
  readonly syscall: Syscall;
  readonly messages: LlmMessage[];
  readonly producedRefs: ContentRef[];
  readonly ledger: OperationLedger;
  readonly turns: number;
  readonly startTime: number;
  readonly maxTimeMs: number;
  readonly options: RunOptions | undefined;
}

async function executeOneToolCall(
  ctx: ToolExecutionContext,
  toolCall: LlmToolCallResult,
  isLast: boolean,
): Promise<ToolRunOutcome> {
  const limitResult = checkRunLimits(
    ctx.options,
    ctx.maxTimeMs,
    Number.MAX_SAFE_INTEGER,
    ctx.turns,
    ctx.startTime,
    ctx.producedRefs,
    ctx.ledger,
  );
  if (limitResult !== undefined) return limitResult;
  emitToolStart(ctx, toolCall);
  let result: ToolDispatchResult;
  try {
    result = await dispatchToolCall(ctx.syscall, toolCall, ctx.producedRefs, ctx.ledger);
  } catch (caught: unknown) {
    return failedToolDispatch(ctx, toolCall, caught);
  }
  if (result.isDone) return processDoneDispatch(ctx, toolCall, result, isLast);
  recordAndEmitDispatch(ctx, toolCall, result);
  if (!result.ok && result.affectsResolution === false) {
    return terminalRecoveryProtocolFailure(ctx, toolCall, result.content);
  }
  return undefined;
}

function terminalRecoveryProtocolFailure(
  ctx: ToolExecutionContext,
  toolCall: LlmToolCallResult,
  message: string,
): RunResult {
  const error: RunError = {
    phase: "tool",
    message,
    retryable: false,
    toolCallId: toolCall.id,
    toolName: toolCall.name,
  };
  ctx.options?.onEvent?.({
    kind: "error",
    turn: ctx.turns,
    phase: "tool",
    message,
    retryable: false,
  });
  return mkResult(
    false,
    message,
    ctx.turns,
    ctx.startTime,
    ctx.producedRefs,
    "error",
    ctx.ledger,
    error,
  );
}

function emitToolStart(ctx: ToolExecutionContext, toolCall: LlmToolCallResult): void {
  const coordination = isCoordinationToolCall(toolCall.name);
  ctx.options?.onEvent?.({
    kind: "tool_start",
    turn: ctx.turns,
    toolCallId: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments,
    ...(coordination ? { coordination: true } : {}),
  });
}

function failedToolDispatch(
  ctx: ToolExecutionContext,
  toolCall: LlmToolCallResult,
  caught: unknown,
): RunResult {
  const message = caught instanceof Error ? caught.message : String(caught);
  const output = `[ERROR] ${toolCall.name} threw: ${message}`;
  const coordination = isCoordinationToolCall(toolCall.name);
  ctx.ledger.record(toolCall, false, coordination);
  const error: RunError = {
    phase: "tool",
    message,
    retryable: false,
    toolCallId: toolCall.id,
    toolName: toolCall.name,
  };
  ctx.options?.onEvent?.({
    kind: "tool_end",
    turn: ctx.turns,
    toolCallId: toolCall.id,
    name: toolCall.name,
    ok: false,
    output,
    ...(coordination ? { coordination: true } : {}),
  });
  ctx.options?.onEvent?.({
    kind: "error",
    turn: ctx.turns,
    phase: "tool",
    message,
    retryable: false,
  });
  ctx.messages.push({ role: "tool", toolCallId: toolCall.id, content: output });
  return mkResult(
    false,
    `Tool error (${toolCall.name}): ${message}`,
    ctx.turns,
    ctx.startTime,
    ctx.producedRefs,
    "error",
    ctx.ledger,
    error,
  );
}

function processDoneDispatch(
  ctx: ToolExecutionContext,
  toolCall: LlmToolCallResult,
  result: ToolDispatchResult,
  isLast: boolean,
): ToolRunOutcome {
  if (!isLast) {
    const output = "[ERROR] Duplicate done calls are not a valid completion declaration.";
    ctx.ledger.record(toolCall, false, false, false);
    ctx.options?.onEvent?.({
      kind: "tool_end",
      turn: ctx.turns,
      toolCallId: toolCall.id,
      name: toolCall.name,
      ok: false,
      output,
    });
    ctx.messages.push({ role: "tool", toolCallId: toolCall.id, content: output });
    const error: RunError = {
      phase: "tool",
      message: output,
      retryable: false,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
    };
    return mkResult(
      false,
      output,
      ctx.turns,
      ctx.startTime,
      ctx.producedRefs,
      "error",
      ctx.ledger,
      error,
    );
  }
  if (!result.ok) {
    recordAndEmitDispatch(ctx, toolCall, result);
    return undefined;
  }
  // `done` is an advisory signal: the model claims completion. Record the call,
  // preserve the tool result for the transcript, then hand control to the
  // termination controller. The controller — not this call — decides whether
  // the run is actually done (DONE), needs more evidence (VERIFY), or should
  // keep working (CONTINUE/REPLAN). Unresolved-failure integrity is still
  // enforced: dispatchControlVerdict builds the terminal result via settleRun,
  // which flips ok=false when tool failures remain unresolved.
  ctx.ledger.clearPriorCompletionFailure();
  const doneOk = ctx.ledger.unresolvedCount === 0;
  ctx.ledger.record(toolCall, doneOk, false, false);
  // When tool failures remain unresolved the done claim cannot honestly report
  // success: surface the unresolved-failure reason on the tool_end event so the
  // transcript and observers see why ok is false, not just the model's summary.
  const doneOutput = doneOk
    ? result.content
    : `unresolved tool failure(s) remain (${ctx.ledger.unresolvedTools.join(", ")}).`;
  ctx.options?.onEvent?.({
    kind: "tool_end",
    turn: ctx.turns,
    toolCallId: toolCall.id,
    name: toolCall.name,
    ok: doneOk,
    output: doneOutput,
  });
  ctx.messages.push({ role: "tool", toolCallId: toolCall.id, content: doneOutput });
  return { doneSignaled: true, summary: result.content };
}

function recordAndEmitDispatch(
  ctx: ToolExecutionContext,
  toolCall: LlmToolCallResult,
  result: ToolDispatchResult,
): void {
  const ledgerResult = recordDispatchResult(ctx.ledger, toolCall, result);
  const warning =
    ledgerResult.resolution === "invalid_explicit"
      ? `\n[Warning] Recovery link ${RECOVERY_ARGUMENT_KEY}=${ledgerResult.recoveryOf} did not identify one unresolved ${toolCall.name} call; no failure was cleared.`
      : "";
  const output = `${result.content}${warning}`;
  const coordination = isCoordinationToolCall(toolCall.name);
  ctx.options?.onEvent?.({
    kind: "tool_end",
    turn: ctx.turns,
    toolCallId: toolCall.id,
    name: toolCall.name,
    ok: result.ok,
    output,
    ...(coordination ? { coordination: true } : {}),
  });
  ctx.messages.push({ role: "tool", toolCallId: toolCall.id, content: output });
}

function recordDispatchResult(
  ledger: OperationLedger,
  toolCall: LlmToolCallResult,
  result: ToolDispatchResult,
): LedgerRecordResult {
  if (result.observationFailure !== undefined)
    return ledger.recordExternalObservationFailure(toolCall, result.observationFailure);
  if (result.retriedObservation !== undefined && result.ok)
    return ledger.resolveExternalObservation(result.retriedObservation, toolCall);
  return ledger.record(toolCall, result.ok, result.coordination, result.affectsResolution ?? true);
}

function isCoordinationToolCall(name: string): boolean {
  return (
    name !== "done" &&
    name !== "read_content" &&
    name !== "write_content" &&
    name !== RETRY_TOOL_OBSERVATION &&
    !name.startsWith("tool:")
  );
}

async function callLlmWithTimeout(
  llm: LlmAdapter,
  messages: readonly LlmMessage[],
  tools: readonly LlmToolDef[],
  timeoutMs: number,
  parentSignal?: AbortSignal,
  onDelta?: (text: string) => void,
  onDiagnostic?: (message: string, detail: string) => void,
): Promise<LlmChatResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;
  let acceptsDeltas = true;

  const request = { messages, tools, signal: controller.signal };
  // Convert the adapter promise into an observed promise before racing it: a
  // late rejection after timeout/abort is consumed here and cannot become an
  // unhandled rejection or trigger any dispatch path.
  const adapterPromise = Promise.resolve().then(async () => {
    if (llm.stream !== undefined && onDelta !== undefined) {
      return consumeStream(
        llm.stream(request),
        (text) => {
          if (acceptsDeltas) onDelta(text);
        },
        onDiagnostic,
      );
    }
    return llm.chat(request);
  });
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AgentLoopTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  const aborted = new Promise<never>((_resolve, reject) => {
    onParentAbort = () => {
      controller.abort();
      reject(new AgentLoopAbortError());
    };
    if (parentSignal?.aborted) onParentAbort();
    else parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  });

  try {
    return await Promise.race([adapterPromise, deadline, aborted]);
  } finally {
    acceptsDeltas = false;
    if (timer !== undefined) clearTimeout(timer);
    if (onParentAbort !== undefined) parentSignal?.removeEventListener("abort", onParentAbort);
    void adapterPromise.catch(() => undefined);
  }
}

class AgentLoopAbortError extends Error {
  constructor() {
    super("LLM request aborted by caller");
    this.name = "AgentLoopAbortError";
  }
}

class AgentLoopTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`);
    this.name = "AgentLoopTimeoutError";
  }
}

async function consumeStream(
  stream: AsyncIterable<LlmStreamChunk>,
  onDelta: (text: string) => void,
  onDiagnostic?: (message: string, detail: string) => void,
): Promise<LlmChatResponse> {
  let skippedToolCallFrames = 0;
  for await (const rawChunk of stream as AsyncIterable<unknown>) {
    const chunk = requireStreamChunk(rawChunk);
    if (chunk.kind === "text_delta") {
      onDelta(chunk.text);
    } else if (chunk.kind === "tool_call_delta" && !chunk.valid) {
      // A malformed tool-call frame is skipped rather than allowed to kill the
      // whole stream. The adapter layer normalizes most provider drift before
      // it reaches here; this is the second line of defense, so when it fires
      // the user genuinely needs to see which field/frame was at fault.
      skippedToolCallFrames++;
      onDiagnostic?.(
        `LLM stream skipped a malformed tool-call delta (${chunk.reason}).`,
        `field=${chunk.field ?? "unknown"}${chunk.indexValue !== undefined ? `; index=${stringifyForDetail(chunk.indexValue)}` : ""}`,
      );
    }
    if (chunk.kind === "done") {
      if (skippedToolCallFrames > 0) {
        onDiagnostic?.(
          `LLM stream completed after skipping ${skippedToolCallFrames} malformed tool-call frame(s).`,
          `skippedFrames=${skippedToolCallFrames}`,
        );
      }
      return chunk.response;
    }
  }
  throw new Error("LLM stream ended without a terminal chunk");
}

/** Best-effort stringification for diagnostic detail; never throws. */
function stringifyForDetail(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

type ParsedStreamChunk =
  | { readonly kind: "text_delta"; readonly text: string }
  | {
      readonly kind: "tool_call_delta";
      /** False when the frame failed validation and must be skipped. */
      readonly valid: boolean;
      readonly reason?: string;
      readonly field?: string;
      /** The raw index value, surfaced in diagnostics when validation failed. */
      readonly indexValue?: unknown;
    }
  | { readonly kind: "done"; readonly response: LlmChatResponse };

function requireStreamChunk(value: unknown): ParsedStreamChunk {
  const chunk = recordValue(detachedBoundaryValue(value, "LLM stream"));
  if (chunk === undefined || typeof chunk["kind"] !== "string") {
    throw new TypeError("LLM stream yielded an invalid chunk.");
  }
  switch (chunk["kind"]) {
    case "text_delta":
      if (typeof chunk["text"] !== "string") {
        throw new TypeError("LLM stream yielded an invalid text delta.");
      }
      return { kind: "text_delta", text: chunk["text"] };
    case "tool_call_delta": {
      const result = validateToolCallDelta(chunk);
      return {
        kind: "tool_call_delta",
        ...result,
        ...(result.valid ? {} : { indexValue: chunk["index"] }),
      };
    }
    case "done":
      return { kind: "done", response: requireLlmResponse(chunk["response"]) };
    default:
      throw new TypeError(`LLM stream yielded unknown chunk kind "${chunk["kind"]}".`);
  }
}

/**
 * Validate a tool-call delta frame. Returns `{ valid: false, reason, field }`
 * for a malformed frame so {@link consumeStream} can skip it and surface a
 * diagnostic, instead of throwing and killing the whole stream. The adapter
 * layer normalizes the common provider drift; this guard catches anything
 * that still slips through without making the run unrecoverable.
 */
function validateToolCallDelta(chunk: Record<string, unknown>): {
  valid: boolean;
  reason?: string;
  field?: string;
} {
  const index = chunk["index"];
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) {
    return { valid: false, reason: "index is not a non-negative integer", field: "index" };
  }
  if (chunk["id"] !== undefined && typeof chunk["id"] !== "string") {
    return { valid: false, reason: "id is not a string", field: "id" };
  }
  if (chunk["name"] !== undefined && typeof chunk["name"] !== "string") {
    return { valid: false, reason: "name is not a string", field: "name" };
  }
  if (chunk["argumentsDelta"] !== undefined && typeof chunk["argumentsDelta"] !== "string") {
    return { valid: false, reason: "argumentsDelta is not a string", field: "argumentsDelta" };
  }
  return { valid: true };
}

interface ToolDispatchResult {
  readonly content: string;
  readonly isDone: boolean;
  /**
   * Whether the call succeeded. Reported by each dispatcher rather than sniffed
   * from an `[ERROR]` prefix on the content, so a tool whose legitimate output
   * happens to start that way is no longer counted as a failure.
   */
  readonly ok: boolean;
  /** True for admission-gated operations, which are the ones the ledger counts. */
  readonly coordination: boolean;
  /** Persisted identity for a tool output whose runtime observation is unresolved. */
  readonly observationFailure?: ToolObservationRecovery;
  /** Identity whose observation this call retried without executing the tool again. */
  readonly retriedObservation?: ToolObservationRecovery;
  /** False when this attempt must not create or generically clear a ledger entry. */
  readonly affectsResolution?: boolean;
}

const SHA256_CONTENT_REF = /^sha256:[0-9a-f]{64}$/u;

function requireReadResult(value: unknown): {
  readonly found: boolean;
  readonly text: string | undefined;
} {
  const record = recordValue(detachedBoundaryValue(value, "Syscall readContent"));
  if (
    record === undefined ||
    (record["found"] !== true && record["found"] !== false) ||
    (record["text"] !== undefined && typeof record["text"] !== "string") ||
    (record["mimeType"] !== undefined && typeof record["mimeType"] !== "string")
  ) {
    throw new TypeError("Syscall readContent returned an invalid result.");
  }
  return {
    found: record["found"],
    text: typeof record["text"] === "string" ? record["text"] : undefined,
  };
}

function requireContentRef(value: unknown, source: string): ContentRef {
  if (typeof value !== "string" || !SHA256_CONTENT_REF.test(value)) {
    throw new TypeError(`${source} returned an invalid ContentRef.`);
  }
  return value as ContentRef;
}

function requireToolResult(
  value: unknown,
  toolCall: LlmToolCallResult,
): {
  readonly ok: boolean;
  readonly output: string;
  readonly contentRef: ContentRef | undefined;
  readonly observeWarning: string | undefined;
  readonly observationRecovery: ToolObservationRecovery | undefined;
} {
  const record = recordValue(detachedBoundaryValue(value, "Syscall useTool"));
  if (
    record === undefined ||
    (record["ok"] !== true && record["ok"] !== false) ||
    typeof record["output"] !== "string" ||
    (record["observeWarning"] !== undefined && typeof record["observeWarning"] !== "string")
  ) {
    throw new TypeError("Syscall useTool returned an invalid result.");
  }
  const contentRef =
    record["contentRef"] === undefined
      ? undefined
      : requireContentRef(record["contentRef"], "Syscall useTool");
  const recoveryRecord = recordValue(record["observationRecovery"]);
  const observationRecovery =
    record["observationRecovery"] === undefined || recoveryRecord === undefined
      ? undefined
      : parseToolObservationRecovery(recoveryRecord);
  const expectedToolName = toolCall.name.slice(5);
  const expectedDigest = toolArgumentsDigest(toolExecutionArguments(toolCall.arguments));
  if (
    (record["observationRecovery"] !== undefined && observationRecovery === undefined) ||
    (observationRecovery !== undefined &&
      (record["ok"] !== false ||
        contentRef !== observationRecovery.outputRef ||
        observationRecovery.toolName !== expectedToolName ||
        observationRecovery.originalToolCallId !== toolCall.id ||
        observationRecovery.argumentsDigest !== expectedDigest)) ||
    (record["ok"] === true &&
      (contentRef === undefined ||
        observationRecovery !== undefined ||
        record["observeWarning"] !== undefined))
  ) {
    throw new TypeError("Syscall useTool returned an invalid observation recovery identity.");
  }
  return {
    ok: record["ok"],
    output: record["output"],
    contentRef,
    observeWarning:
      typeof record["observeWarning"] === "string" ? record["observeWarning"] : undefined,
    observationRecovery,
  };
}

function requireRetryResult(
  value: unknown,
  recovery: ToolObservationRecovery,
): {
  readonly ok: boolean;
  readonly outputRef: ContentRef | undefined;
  readonly message: string;
  readonly observeWarning: string | undefined;
} {
  const record = recordValue(detachedBoundaryValue(value, "Syscall retryToolObservation"));
  if (
    record === undefined ||
    (record["ok"] !== true && record["ok"] !== false) ||
    typeof record["message"] !== "string" ||
    (record["observeWarning"] !== undefined && typeof record["observeWarning"] !== "string")
  ) {
    throw new TypeError("Syscall retryToolObservation returned an invalid result.");
  }
  const outputRef =
    record["outputRef"] === undefined
      ? undefined
      : requireContentRef(record["outputRef"], "Syscall retryToolObservation");
  if (
    (record["ok"] === true &&
      (outputRef !== recovery.outputRef || record["observeWarning"] !== undefined)) ||
    (record["ok"] === false && outputRef !== undefined)
  ) {
    throw new TypeError(
      "Syscall retryToolObservation returned a contradictory observation result.",
    );
  }
  return {
    ok: record["ok"],
    outputRef,
    message: record["message"],
    observeWarning:
      typeof record["observeWarning"] === "string" ? record["observeWarning"] : undefined,
  };
}

function requireActionResult(value: unknown): {
  readonly ok: boolean;
  readonly message: string;
} {
  const record = recordValue(detachedBoundaryValue(value, "Syscall act"));
  if (
    record === undefined ||
    (record["ok"] !== true && record["ok"] !== false) ||
    typeof record["message"] !== "string" ||
    (record["newHeadRef"] !== undefined &&
      (typeof record["newHeadRef"] !== "string" || record["newHeadRef"] === "")) ||
    (record["ok"] === false && record["newHeadRef"] !== undefined) ||
    (record["ok"] === true &&
      (typeof record["newHeadRef"] !== "string" || record["newHeadRef"] === ""))
  ) {
    throw new TypeError("Syscall act returned an invalid result.");
  }
  return { ok: record["ok"], message: record["message"] };
}

async function dispatchToolCall(
  syscall: Syscall,
  toolCall: LlmToolCallResult,
  producedRefs: ContentRef[],
  ledger: OperationLedger,
): Promise<ToolDispatchResult> {
  switch (toolCall.name) {
    case "done":
      return dispatchDoneToolCall(toolCall);
    case "read_content":
      return dispatchReadContentToolCall(syscall, toolCall);
    case "write_content":
      return dispatchWriteContentToolCall(syscall, toolCall, producedRefs);
    case RETRY_TOOL_OBSERVATION:
      return dispatchRetryToolObservation(syscall, toolCall, ledger);
    default:
      if (toolCall.name.startsWith("tool:")) {
        return dispatchExternalToolCall(syscall, toolCall, producedRefs, ledger);
      }
      return dispatchActToolCall(syscall, toolCall);
  }
}

function dispatchDoneToolCall(toolCall: LlmToolCallResult): ToolDispatchResult {
  const raw = toolCall.arguments["summary"];
  if (typeof raw !== "string" || raw.trim() === "") {
    return {
      content: "[ERROR] done requires a non-empty 'summary' parameter.",
      isDone: false,
      ok: false,
      coordination: false,
    };
  }
  return { content: raw, isDone: true, ok: true, coordination: false };
}

async function dispatchReadContentToolCall(
  syscall: Syscall,
  toolCall: LlmToolCallResult,
): Promise<ToolDispatchResult> {
  const rawRef = toolCall.arguments["ref"];
  const ref = typeof rawRef === "string" ? rawRef : "";
  if (ref === "") {
    return {
      content: "[ERROR] read_content requires a non-empty 'ref' parameter.",
      isDone: false,
      ok: false,
      coordination: false,
    };
  }
  const readResult = requireReadResult(await syscall.readContent(ref as ContentRef));
  const content = readResult.found
    ? (readResult.text ?? "(binary content)")
    : `[ERROR] Content not found for ref: "${ref}". Verify the ref is correct.`;
  return { content, isDone: false, ok: readResult.found, coordination: false };
}

async function dispatchWriteContentToolCall(
  syscall: Syscall,
  toolCall: LlmToolCallResult,
  producedRefs: ContentRef[],
): Promise<ToolDispatchResult> {
  const rawText = toolCall.arguments["content"];
  const text = typeof rawText === "string" ? rawText : "";
  if (text === "") {
    return {
      content: "[ERROR] write_content requires non-empty 'content' parameter.",
      isDone: false,
      ok: false,
      coordination: false,
    };
  }
  const rawMime = toolCall.arguments["mimeType"];
  const mimeType = typeof rawMime === "string" ? rawMime : undefined;
  const ref = requireContentRef(
    await syscall.writeContent(text, mimeType ? { mimeType } : undefined),
    "Syscall writeContent",
  );
  producedRefs.push(ref);
  return { content: `Written. ref=${String(ref)}`, isDone: false, ok: true, coordination: false };
}

async function dispatchExternalToolCall(
  syscall: Syscall,
  toolCall: LlmToolCallResult,
  producedRefs: ContentRef[],
  ledger: OperationLedger,
): Promise<ToolDispatchResult> {
  const explicitRecoveryOf = toolRecoveryOf(toolCall);
  const pending =
    explicitRecoveryOf === undefined
      ? ledger.externalObservationForExactRetry(toolCall)
      : ledger.externalObservationForCall(toolCall.name, explicitRecoveryOf);
  if (explicitRecoveryOf !== undefined && pending === undefined) {
    return {
      content:
        `[ERROR] External tools cannot use generic ${RECOVERY_ARGUMENT_KEY} recovery. ` +
        "The id must name this exact tool's unresolved stored-output observation.",
      isDone: false,
      ok: false,
      coordination: false,
      affectsResolution: false,
    };
  }
  if (pending !== undefined) {
    return retryStoredToolObservation(syscall, pending);
  }
  if (ledger.hasUnresolvedExactExternalFailure(toolCall)) {
    return {
      content:
        "[ERROR] Refusing to re-execute an unresolved external call without a verified " +
        "stored-output observation receipt.",
      isDone: false,
      ok: false,
      coordination: false,
      affectsResolution: false,
    };
  }

  const toolResult = requireToolResult(
    await syscall.useTool({
      callId: toolCall.id,
      toolName: toolCall.name.slice(5),
      args: toolExecutionArguments(toolCall.arguments),
    }),
    toolCall,
  );
  let content = toolResult.ok ? toolResult.output : `[ERROR] ${toolResult.output}`;
  if (toolResult.observeWarning) {
    content += `\n[Warning] ${toolResult.observeWarning}`;
  }
  if (toolResult.observationRecovery !== undefined) {
    content += `\n[Recovery] ${recoveryInstruction(toolResult.observationRecovery)}`;
  }
  if (toolResult.contentRef) producedRefs.push(toolResult.contentRef);
  return {
    content,
    isDone: false,
    ok: toolResult.ok,
    coordination: false,
    ...(toolResult.observationRecovery === undefined
      ? {}
      : { observationFailure: toolResult.observationRecovery }),
  };
}

async function dispatchRetryToolObservation(
  syscall: Syscall,
  toolCall: LlmToolCallResult,
  ledger: OperationLedger,
): Promise<ToolDispatchResult> {
  const recovery = parseToolObservationRecovery(toolCall.arguments);
  if (recovery === undefined) {
    return {
      content:
        "[ERROR] retry_tool_observation requires toolName, originalToolCallId, " +
        "argumentsDigest, outputRef, and receiptRef.",
      isDone: false,
      ok: false,
      coordination: false,
      affectsResolution: false,
    };
  }
  const pending = ledger.externalObservationForCall(
    receiptToolName(recovery),
    recovery.originalToolCallId,
  );
  if (!sameObservationRecovery(pending, recovery)) {
    return {
      content: "[ERROR] Recovery identity does not match one unresolved external-tool observation.",
      isDone: false,
      ok: false,
      coordination: false,
      affectsResolution: false,
    };
  }
  return retryStoredToolObservation(syscall, recovery);
}

async function retryStoredToolObservation(
  syscall: Syscall,
  recovery: ToolObservationRecovery,
): Promise<ToolDispatchResult> {
  const retry = requireRetryResult(await syscall.retryToolObservation(recovery), recovery);
  const warning = retry.observeWarning === undefined ? "" : `\n[Warning] ${retry.observeWarning}`;
  return {
    content: `${retry.ok ? retry.message : `[ERROR] ${retry.message}`}${warning}`,
    isDone: false,
    ok: retry.ok,
    coordination: false,
    retriedObservation: recovery,
    ...(!retry.ok ? { affectsResolution: false } : {}),
  };
}

function parseToolObservationRecovery(
  args: Readonly<Record<string, unknown>>,
): ToolObservationRecovery | undefined {
  const toolName = args["toolName"];
  const originalToolCallId = args["originalToolCallId"];
  const argumentsDigest = args["argumentsDigest"];
  const outputRef = args["outputRef"];
  const receiptRef = args["receiptRef"];
  if (
    typeof toolName !== "string" ||
    toolName === "" ||
    typeof originalToolCallId !== "string" ||
    originalToolCallId === "" ||
    typeof argumentsDigest !== "string" ||
    !SHA256_CONTENT_REF.test(argumentsDigest) ||
    typeof outputRef !== "string" ||
    !SHA256_CONTENT_REF.test(outputRef) ||
    typeof receiptRef !== "string" ||
    !SHA256_CONTENT_REF.test(receiptRef)
  ) {
    return undefined;
  }
  return {
    toolName,
    originalToolCallId,
    argumentsDigest,
    outputRef: outputRef as ContentRef,
    receiptRef: receiptRef as ContentRef,
  };
}

function sameObservationRecovery(
  left: ToolObservationRecovery | undefined,
  right: ToolObservationRecovery,
): boolean {
  return (
    left !== undefined &&
    left.toolName === right.toolName &&
    left.originalToolCallId === right.originalToolCallId &&
    left.argumentsDigest === right.argumentsDigest &&
    left.outputRef === right.outputRef &&
    left.receiptRef === right.receiptRef
  );
}

function recoveryInstruction(recovery: ToolObservationRecovery): string {
  return (
    `Retry only the stored observation with ${RETRY_TOOL_OBSERVATION} ` +
    `${JSON.stringify(recovery)}. Do not call the external tool again.`
  );
}

async function dispatchActToolCall(
  syscall: Syscall,
  toolCall: LlmToolCallResult,
): Promise<ToolDispatchResult> {
  const args: Record<string, string> = {};
  for (const [k, v] of Object.entries(toolExecutionArguments(toolCall.arguments))) {
    if (typeof v !== "string") {
      return {
        content: `[ERROR] Coordination argument "${k}" must be a string.`,
        isDone: false,
        ok: false,
        coordination: true,
      };
    }
    args[k] = v;
  }
  const actionResult = requireActionResult(await syscall.act({ operation: toolCall.name, args }));
  const content = actionResult.ok ? actionResult.message : `[ERROR] ${actionResult.message}`;
  return { content, isDone: false, ok: actionResult.ok, coordination: true };
}

function initializeMessages(seed: readonly LlmMessage[], systemPrompt: string): LlmMessage[] {
  const normalized = normalizeHistoryMessages(seed);
  const transcript = normalized.filter(
    (message) => message.role !== "system" || isCompactionMarker(message),
  );
  return [{ role: "system", content: systemPrompt }, ...transcript];
}

/**
 * Validate persisted/seed history before trusting it as model context. Tool
 * results are retained only as a complete, ordered group immediately following
 * the assistant message that requested them. This prevents a UI transcript
 * from accidentally inventing evidence that a tool call ran.
 */
function normalizeHistoryMessages(input: readonly LlmMessage[]): LlmMessage[] {
  const normalized: LlmMessage[] = [];
  let sawMarker = false;

  for (let index = 0; index < input.length; index++) {
    const message = input[index];
    if (message === undefined || message.role === "tool") continue;
    if (isCompactionMarker(message)) {
      if (!sawMarker) normalized.push(cloneMessage(message));
      sawMarker = true;
      continue;
    }

    if (message.role === "assistant" && (message.toolCalls?.length ?? 0) > 0) {
      const calls = message.toolCalls ?? [];
      const results = input.slice(index + 1, index + 1 + calls.length);
      const complete =
        new Set(calls.map((call) => call.id)).size === calls.length &&
        results.length === calls.length &&
        results.every(
          (result, resultIndex) =>
            result.role === "tool" && result.toolCallId === calls[resultIndex]?.id,
        );
      if (complete) {
        normalized.push(cloneMessage(message), ...results.map((result) => cloneMessage(result)));
        index += calls.length;
      }
      continue;
    }

    normalized.push(cloneMessage(message));
  }

  return normalized;
}

function cloneMessage(message: LlmMessage): LlmMessage {
  switch (message.role) {
    case "system":
    case "user":
      return { role: message.role, content: message.content };
    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls === undefined
          ? {}
          : { toolCalls: message.toolCalls.map((call) => ({ ...call })) }),
      };
    case "tool":
      return { role: "tool", toolCallId: message.toolCallId, content: message.content };
  }
}

function isCompactionMarker(message: LlmMessage): boolean {
  return message.role === "system" && message.content.startsWith(COMPACTION_MARKER_PREFIX);
}

function markerDroppedCount(message: LlmMessage): number {
  if (!isCompactionMarker(message)) return 0;
  const match = /compacted:\s*(\d+)/u.exec(message.content);
  return match === null ? 0 : Number(match[1]);
}

interface MessageUnit {
  readonly indices: readonly number[];
}

function messageUnits(messages: readonly LlmMessage[]): MessageUnit[] {
  const units: MessageUnit[] = [];
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role === "assistant" && (message.toolCalls?.length ?? 0) > 0) {
      const indices = [index];
      let cursor = index + 1;
      while (cursor < messages.length && messages[cursor]?.role === "tool") {
        indices.push(cursor);
        cursor++;
      }
      units.push({ indices });
      index = cursor - 1;
    } else {
      units.push({ indices: [index] });
    }
  }
  return units;
}

/**
 * Return a context window that never exceeds `maxMessages`.
 *
 * The current run's initial user goal has first retention priority, followed by
 * the canonical system prompt and then the newest complete message groups.
 * Assistant tool calls and their tool results are selected as one unit, so a
 * compacted request never contains one side of the provider protocol alone.
 */
function compactMessages(
  messages: readonly LlmMessage[],
  maxMessages: number,
  initialGoal: LlmMessage,
): LlmMessage[] {
  const limit = Math.max(0, Math.floor(maxMessages));
  if (limit === 0) return [];

  let previouslyDropped = 0;
  const core = messages.filter((message) => {
    if (!isCompactionMarker(message)) return true;
    previouslyDropped += markerDroppedCount(message);
    return false;
  });

  const goalIndex = core.indexOf(initialGoal);
  const systemIndex = core.findIndex((message) => message.role === "system");
  const required = new Set<number>();
  if (goalIndex >= 0) required.add(goalIndex);
  if (systemIndex >= 0 && required.size < limit) required.add(systemIndex);

  const units = messageUnits(core);
  const latestToolUnit = [...units].reverse().find((unit) => {
    const message = core[unit.indices[0] ?? -1];
    return message?.role === "assistant" && (message.toolCalls?.length ?? 0) > 0;
  });
  if (latestToolUnit !== undefined && latestToolUnit.indices.length <= limit - required.size) {
    for (const messageIndex of latestToolUnit.indices) required.add(messageIndex);
  }

  const candidates = units.filter((unit) => !unit.indices.some((index) => required.has(index)));

  const selectWithMarkerSlots = (markerSlots: number): Set<number> => {
    let remaining = limit - required.size - markerSlots;
    const selected = new Set(required);
    for (let index = candidates.length - 1; index >= 0; index--) {
      const unit = candidates[index];
      if (unit === undefined || unit.indices.length > remaining) continue;
      for (const messageIndex of unit.indices) selected.add(messageIndex);
      remaining -= unit.indices.length;
    }
    return selected;
  };

  // A compaction marker is explanatory metadata; it must yield whenever that
  // slot would otherwise retain one more exact conversation/tool unit.
  let markerSlots = (previouslyDropped > 0 || core.length > limit) && required.size < limit ? 1 : 0;
  let selected = selectWithMarkerSlots(markerSlots);
  if (markerSlots === 1) {
    const withoutMarker = selectWithMarkerSlots(0);
    if (withoutMarker.size > selected.size) {
      markerSlots = 0;
      selected = withoutMarker;
    }
  }

  const retainedIndices = [...selected].sort((left, right) => left - right);
  const retained = retainedIndices
    .map((index) => core[index])
    .filter((message): message is LlmMessage => message !== undefined);
  const dropped = previouslyDropped + core.length - retained.length;
  if (dropped <= 0 || markerSlots === 0) return retained.slice(0, limit);

  const marker: LlmMessage = {
    role: "system",
    content: `${COMPACTION_MARKER_PREFIX} ${String(dropped)} earlier message(s) omitted.]`,
  };
  const retainedSystemIndex = retained.findIndex((message) => message === core[systemIndex]);
  if (retainedSystemIndex < 0) return [marker, ...retained].slice(0, limit);
  return [
    ...retained.slice(0, retainedSystemIndex + 1),
    marker,
    ...retained.slice(retainedSystemIndex + 1),
  ].slice(0, limit);
}

type TerminationReason = NonNullable<RunResult["terminationReason"]>;

function mkResult(
  ok: boolean,
  summary: string,
  turns: number,
  startTime: number,
  producedRefs: readonly ContentRef[],
  terminationReason: TerminationReason,
  ledger: OperationLedger,
  error?: RunError,
): RunResult {
  return {
    ok,
    summary,
    turns,
    elapsedMs: Date.now() - startTime,
    producedRefs: [...producedRefs],
    terminationReason,
    operations: ledger.operationTally,
    toolCalls: ledger.toolTally,
    ...(error === undefined ? {} : { error }),
  };
}

function buildDefaultSystemPrompt(actorId?: string): string {
  return [
    "You are an autonomous agent operating inside the Cantilune coordination OS.",
    "You have full authority to decide how to accomplish the user's instruction.",
    ...(actorId === undefined
      ? []
      : [
          "",
          `Your actor id is "${actorId}".`,
          `Pass "${actorId}" as the 'from' role of every operation you initiate — acting on`,
          "behalf of another participant is refused as principal_invalid.",
        ]),
    "",
    "Available capabilities:",
    "- Introduce artifacts (tasks, documents, code)",
    "- Delegate tasks to other participants",
    "- Fork parallel branches",
    "- Create communication sessions",
    "- Read/write content (read_content / write_content tools)",
    "- Use external tools (prefixed with tool:)",
    "",
    "Rules:",
    "- Every operation goes through admission — illegal ops will be rejected with explanation.",
    "- Call the 'done' tool when the user's instruction is fully completed.",
    "- If an operation fails, read the error message and adjust your approach.",
    `- For read_content/write_content only, a successful exact retry clears its matching failure; corrected arguments may name the failed call with '${RECOVERY_ARGUMENT_KEY}'.`,
    `- Never rerun an external tool whose output was stored but audit observation failed. Use ${RETRY_TOOL_OBSERVATION} with the exact recovery identity returned by the failed call.`,
    `- Coordination operations never accept '${RECOVERY_ARGUMENT_KEY}'; a different successful operation cannot clear a rejected one.`,
    "- Be efficient: minimize unnecessary operations.",
  ].join("\n");
}

function buildContextMessage(worldSummary: string, observations: string): string {
  return [
    "=== Current World State ===",
    worldSummary,
    "",
    "=== Recent Observations ===",
    observations,
  ].join("\n");
}

function actionsToToolDefs(actions: readonly ActionSchema[]): LlmToolDef[] {
  const names = new Set(actions.map((a) => a.name));
  const defs: LlmToolDef[] = actions.map((a) => ({
    name: a.name,
    description: a.description,
    parameters: supportsExplicitRecovery(a.name)
      ? withRecoveryParameter(a.parameters)
      : a.parameters,
  }));

  if (!names.has("read_content")) {
    defs.push({
      name: "read_content",
      description: "Read content by ContentRef. Returns the text stored at that ref.",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string", description: "ContentRef string (e.g., sha256:...)" },
          [RECOVERY_ARGUMENT_KEY]: recoveryParameterDefinition(),
        },
        required: ["ref"],
      },
    });
  }

  if (!names.has("write_content")) {
    defs.push({
      name: "write_content",
      description: "Write text content to the content store. Returns a ContentRef.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Text content to store" },
          mimeType: { type: "string", description: "MIME type (default: text/plain)" },
          [RECOVERY_ARGUMENT_KEY]: recoveryParameterDefinition(),
        },
        required: ["content"],
      },
    });
  }

  if (!names.has("done")) {
    defs.push({
      name: "done",
      description: "Declare that the task is complete. You MUST call this when finished.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Summary of what was accomplished" },
        },
        required: ["summary"],
      },
    });
  }

  defs.push({
    name: RETRY_TOOL_OBSERVATION,
    description:
      "Retry only runtime observation of one already-stored external-tool output. Never executes the external tool.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        toolName: { type: "string", description: "Original external executor tool name" },
        originalToolCallId: { type: "string", description: "Exact original LLM tool-call id" },
        argumentsDigest: { type: "string", description: "Canonical original arguments digest" },
        outputRef: { type: "string", description: "Exact stored output ContentRef" },
        receiptRef: { type: "string", description: "Exact recovery receipt ContentRef" },
      },
      required: ["toolName", "originalToolCallId", "argumentsDigest", "outputRef", "receiptRef"],
    },
  });

  return defs;
}

function supportsExplicitRecovery(name: string): boolean {
  return supportsGenericExplicitRecovery(name);
}

function withRecoveryParameter(
  parameters: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const rawProperties = parameters["properties"];
  const properties =
    rawProperties !== null && typeof rawProperties === "object" && !Array.isArray(rawProperties)
      ? (rawProperties as Record<string, unknown>)
      : {};
  return {
    ...parameters,
    type: parameters["type"] ?? "object",
    properties: {
      ...properties,
      [RECOVERY_ARGUMENT_KEY]: recoveryParameterDefinition(),
    },
  };
}

function recoveryParameterDefinition(): Record<string, unknown> {
  return {
    type: "string",
    description:
      "Exact tool-call id of an unresolved read/write failure that this successful corrected call replaces. Omit for unrelated work and exact retries.",
  };
}
