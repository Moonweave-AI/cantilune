import { useCallback, useRef, useState } from "react";
import { createAdapter, createEmbedder } from "@cantilune/adapter";
import type { ContentStore } from "@cantilune/content";
import type { AgentEvent, AgentLoopHistory, LlmMessage, RunResult } from "@cantilune/boot";
import {
  buildLlmConfig,
  createCliRuntimeBoot,
  missingApiKeyVar,
  type CliRuntimeHandle,
} from "../../runtimeSync.js";
import type { RuntimeResetResult } from "../../commands/registry.js";
import type { ChatMessage, LifecycleLine, ReactiveStore, ToolCallDisplay } from "../../store.js";
import { createEmptySession } from "../../store.js";
import {
  createSessionWorldBinding,
  sessionWorldBindingsEqual,
  type SessionWorldBinding,
} from "./useSession.js";

export interface UseAgentLoopOptions {
  readonly store: ReactiveStore;
  /** Durable generation that authorized the visible conversational seed. */
  readonly sessionSeedWorld?: SessionWorldBinding | null;
  /** Exact Boot-owned private history restored from a v3 session envelope. */
  readonly sessionSeedHistory?: AgentLoopHistory | null;
  /** Clears the App-level seed authority after a generation mismatch. */
  readonly onSessionSeedInvalidated?: () => void;
  /** Awaited Boot-history checkpoint after each completed tool group. */
  readonly onHistoryCheckpoint?: (
    history: AgentLoopHistory,
    world: SessionWorldBinding,
  ) => Promise<void>;
}

export interface UseAgentLoopResult {
  readonly running: boolean;
  readonly start: (instruction: string) => Promise<RunResult | undefined>;
  readonly stop: (mode?: "preserve" | "clear") => Promise<RuntimeResetResult>;
  readonly abort: () => void;
  /** Authority for persisting the visible session; never recomputed from the path at save time. */
  readonly sessionWorld: () => SessionWorldBinding | null;
  /** Detached snapshot from the Boot object actually serving this TUI. */
  readonly privateHistory: () => AgentLoopHistory | null;
  /** Fail-closed boundary used when persistence detects replacement or CAS conflict. */
  readonly isolateSession: (message: string) => Promise<void>;
  /**
   * Live backends of the current runtime handle. `contentStore` powers the
   * /content views; `syscallRuntime` + `storagePath` power /cluster start.
   * Absent before the first successful boot or after shutdown.
   */
  readonly runtimeBackends: () => {
    readonly contentStore: ContentStore | undefined;
    readonly syscallRuntime: ReturnType<CliRuntimeHandle["syscallRuntime"]> | undefined;
    readonly storagePath: string | undefined;
  };
}

function disconnectedRuntime() {
  return { snapshot: null, changeLog: [], epoch: null };
}

/**
 * Patterns a model emits when it meant to call a tool but failed to do so —
 * writing the tool call as prose instead. The most common is a `<done>` tag
 * wrapping JSON (the `done` tool's `{summary}` payload) that should have been
 * a real tool call. Detecting this turns an opaque blob of raw JSON in the
 * transcript into an explicit "the model did not actually call the tool"
 * observation, which is what makes the intermediate process observable.
 */
const PSEUDO_DONE_TAG = /<done\b[^>]*>([\s\S]*?)<\/done>/i;
const PSEUDO_TOOL_TAG =
  /<(?:tool_call|function_call|call)\b[^>]*>([\s\S]*?)<\/(?:tool_call|function_call|call)>/i;
const PSEUDO_JSON_OBJECT = /^\s*\{[\s\S]*"\w+"\s*:[\s\S]*\}\s*$/;

export function detectPseudoToolCall(text: string): {
  detected: boolean;
  tool?: string;
  snippet: string;
} {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { detected: false, snippet: "" };

  const doneMatch = trimmed.match(PSEUDO_DONE_TAG);
  if (doneMatch !== null) {
    return {
      detected: true,
      tool: "done",
      snippet: truncateSnippet(`<done>${doneMatch[1]}</done>`),
    };
  }
  const toolMatch = trimmed.match(PSEUDO_TOOL_TAG);
  if (toolMatch !== null) {
    return {
      detected: true,
      tool: "tool_call",
      snippet: truncateSnippet(toolMatch[0]),
    };
  }
  // A bare JSON object that looks like a tool argument payload (has a key with
  // a quoted value) and is the whole message — not just JSON mentioned inline.
  if (PSEUDO_JSON_OBJECT.test(trimmed)) {
    return { detected: true, tool: "json", snippet: truncateSnippet(trimmed) };
  }
  return { detected: false, snippet: "" };
}

function truncateSnippet(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function runtimeResetOutcome(
  mode: "preserve" | "clear",
  durable: ReturnType<ReactiveStore["get"]>["durable"],
): RuntimeResetResult {
  if (mode === "clear") return { history: "cleared", reason: "explicit_clear" };
  if (durable === "memory") return { history: "cleared", reason: "memory_world_replaced" };
  return { history: "preserved" };
}

function applyStoppedRuntimeState(store: ReactiveStore, outcome: RuntimeResetResult): void {
  const reset = {
    agentRunning: false,
    phase: { kind: "idle" } as const,
    connected: false,
    runtime: disconnectedRuntime(),
    pendingAsk: null,
    mode: "chat" as const,
  };
  if (outcome.history === "preserved") {
    store.set(reset);
    return;
  }
  store.set({
    ...reset,
    session: createEmptySession(),
    ...(outcome.reason === "memory_world_replaced"
      ? {
          notice: {
            level: "warn" as const,
            text: "LLM settings changed in memory mode; private and visible history were cleared because the replacement runtime/content world is new.",
          },
        }
      : {}),
  });
}

function configuredWorld(state: ReturnType<ReactiveStore["get"]>): SessionWorldBinding | null {
  return createSessionWorldBinding({
    durable: state.durable,
    ...(state.storagePath !== undefined ? { storagePath: state.storagePath } : {}),
    ...(state.principalId !== undefined ? { principalId: state.principalId } : {}),
  });
}

function runtimeSignature(state: ReturnType<ReactiveStore["get"]>): string {
  return [
    state.provider,
    state.model,
    state.baseUrl ?? "",
    state.durable,
    state.storagePath ?? "",
    state.principalId ?? "",
    (state.compatibleEpochIds ?? []).join(","),
  ].join("\u0000");
}

function cachedFileWorldChanged(
  cached: CliRuntimeHandle | null,
  durable: ReturnType<ReactiveStore["get"]>["durable"],
  cachedWorld: SessionWorldBinding | null,
  currentWorld: SessionWorldBinding | null,
): boolean {
  return (
    cached !== null && durable === "file" && !sessionWorldBindingsEqual(cachedWorld, currentWorld)
  );
}

function privateSeedWorldChanged(
  durable: ReturnType<ReactiveStore["get"]>["durable"],
  hasPrivateSeed: boolean,
  seedAuthority: SessionWorldBinding | null,
  currentWorld: SessionWorldBinding | null,
): boolean {
  return (
    durable === "file" && hasPrivateSeed && !sessionWorldBindingsEqual(seedAuthority, currentWorld)
  );
}

function bootedFileWorldChanged(input: {
  readonly durable: ReturnType<ReactiveStore["get"]>["durable"];
  readonly bootedWorld: SessionWorldBinding | null;
  readonly currentWorld: SessionWorldBinding | null;
  readonly hasPrivateSeed: boolean;
  readonly seedAuthority: SessionWorldBinding | null;
}): boolean {
  if (input.durable !== "file" || input.bootedWorld === null) return input.durable === "file";
  if (
    input.currentWorld !== null &&
    !sessionWorldBindingsEqual(input.currentWorld, input.bootedWorld)
  ) {
    return true;
  }
  return input.hasPrivateSeed && !sessionWorldBindingsEqual(input.seedAuthority, input.bootedWorld);
}

function bootHandle(
  state: ReturnType<ReactiveStore["get"]>,
  initialMessages: readonly LlmMessage[],
  history?: AgentLoopHistory,
  onHistoryCheckpoint?: (history: AgentLoopHistory) => void | Promise<void>,
): CliRuntimeHandle {
  const llmConfig = buildLlmConfig(state.provider, state.model, state.baseUrl);
  const adapter = createAdapter(llmConfig);
  // The embedder is the controller's optional semantic sensor. Built from the
  // same LlmConfig as the chat adapter but it is a separate object hitting a
  // separate /embeddings endpoint; it never consumes the loop's chat adapter
  // and the residual engine falls back to Jaccard when it returns undefined
  // (native providers) or throws.
  const embedder = createEmbedder(llmConfig);
  // contractLlm is left undefined: the default zero-config path compiles the
  // system contract with no LLM call, which the ADR-0013 design names as the
  // safe default. A dedicated contract model would require a config field that
  // does not yet exist; until then, no contract adapter is wired here.
  return createCliRuntimeBoot(
    adapter,
    {
      durable: state.durable,
      contentStore: state.durable === "file" ? "file" : "memory",
      llm: llmConfig,
      ...(state.storagePath !== undefined ? { storagePath: state.storagePath } : {}),
      ...(state.principalId !== undefined ? { principalId: state.principalId } : {}),
      ...(state.compatibleEpochIds !== undefined
        ? { compatibleEpochIds: state.compatibleEpochIds }
        : {}),
      ...(state.maxTurns !== undefined ? { maxTurns: state.maxTurns } : {}),
      initialMessages,
      ...(history === undefined ? {} : { history }),
      ...(onHistoryCheckpoint === undefined ? {} : { onHistoryCheckpoint }),
    },
    { ...(embedder !== undefined ? { embedder } : {}) },
  );
}

/**
 * Convert only conversational text into a trusted boot seed. UI system/error
 * rows and tool cards are display projections, not proof that a tool executed,
 * so they must never be reconstructed as model tool history.
 */
export function sessionConversationSeed(messages: readonly ChatMessage[]): LlmMessage[] {
  const seed: LlmMessage[] = [];
  for (const message of messages) {
    if (message.content.trim().length === 0) continue;
    if (message.role === "user" || message.role === "assistant") {
      seed.push({ role: message.role, content: message.content });
    }
  }
  return seed;
}

/**
 * Drives one agent run and projects its event stream onto the store.
 *
 * The mapping is deliberately 1:1 with `AgentEvent` so the UI never has to
 * guess what the agent is doing: text deltas grow the current assistant
 * bubble, tool events flip individual tool cards, and phase changes feed the
 * status line spinner.
 */
export function useAgentLoop({
  store,
  sessionSeedWorld = null,
  sessionSeedHistory = null,
  onSessionSeedInvalidated,
  onHistoryCheckpoint,
}: UseAgentLoopOptions): UseAgentLoopResult {
  const [running, setRunning] = useState(false);
  const runtimeHandleRef = useRef<CliRuntimeHandle | null>(null);
  const detachedHistoryRef = useRef<AgentLoopHistory | null>(null);
  /** File-world generation against which the cached OS was actually booted. */
  const runtimeWorldRef = useRef<SessionWorldBinding | null>(null);
  /** World that owns detached exact history after an awaited file reset. */
  const detachedHistoryWorldRef = useRef<SessionWorldBinding | null>(null);
  /** LLM settings the cached handle was booted with. */
  const runtimeSignatureRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Synchronous single-flight guard; React state does not update within the same event turn. */
  const startInFlightRef = useRef(false);
  /** Serializes shutdown and boot across command/reset/start call sites. */
  const lifecycleFlightRef = useRef<Promise<void>>(Promise.resolve());
  /** A failed shutdown permanently blocks replacement boot in this hook. */
  const lifecycleFailureRef = useRef<unknown>(null);
  /** Invalidates late events/results after abort, stop, or `/clear`. */
  const runGenerationRef = useRef(0);
  /** Generation authorized to issue durable history checkpoints. */
  const checkpointGenerationRef = useRef(0);
  /** Index of the assistant message currently being streamed into. */
  const streamingRef = useRef(false);
  /** Resolver for the current ASK_USER pause; fired by the pendingAsk answer. */
  const askResolverRef = useRef<((reply: string) => void) | null>(null);
  /**
   * Timestamp anchor of the assistant message that owns the current turn's
   * lifecycle rail. Created at `llm_start` (an empty streaming bubble that
   * deltas grow into), cleared at `turn_end`. Lifecycle lines attach here so
   * the transcript itself reads as a per-turn lifecycle view by default.
   */
  const lifecycleAnchorRef = useRef<number | null>(null);

  const awaitHealthyLifecycle = useCallback(async (): Promise<void> => {
    await lifecycleFlightRef.current;
    if (lifecycleFailureRef.current !== null) {
      throw new Error("Previous runtime shutdown failed; refusing to boot a replacement handle", {
        cause: lifecycleFailureRef.current,
      });
    }
  }, []);

  const shutdownHandle = useCallback(async (handle: CliRuntimeHandle): Promise<void> => {
    const prior = lifecycleFlightRef.current;
    const shutdown = prior.then(async () => {
      try {
        await handle.shutdown();
      } catch (error) {
        lifecycleFailureRef.current = error;
        throw error;
      }
    });
    lifecycleFlightRef.current = shutdown.catch(() => undefined);
    await shutdown;
  }, []);

  const checkpointHandlerFor = useCallback(
    (
      durable: ReturnType<ReactiveStore["get"]>["durable"],
      world: SessionWorldBinding | null,
    ): ((history: AgentLoopHistory) => Promise<void>) | undefined => {
      if (durable !== "file" || world === null || onHistoryCheckpoint === undefined) {
        return undefined;
      }
      return async (history) => {
        if (checkpointGenerationRef.current !== runGenerationRef.current) {
          throw new Error("Stale agent run cannot checkpoint private history");
        }
        const latest = configuredWorld(store.get());
        if (!sessionWorldBindingsEqual(world, latest)) {
          throw new Error("Durable world generation changed before private history checkpoint");
        }
        await onHistoryCheckpoint(history, world);
      };
    },
    [onHistoryCheckpoint, store],
  );

  const isolateSession = useCallback(
    async (message: string): Promise<void> => {
      const cached = runtimeHandleRef.current;
      runtimeHandleRef.current = null;
      detachedHistoryRef.current = null;
      detachedHistoryWorldRef.current = null;
      runtimeSignatureRef.current = null;
      runtimeWorldRef.current = null;
      streamingRef.current = false;
      askResolverRef.current = null;
      lifecycleAnchorRef.current = null;
      if (cached !== null) {
        // Generation mismatch is the primary safety failure. A shutdown error
        // must not prevent the transcript and references from being isolated.
        await cached.shutdown().catch(() => undefined);
      }
      store.set({
        session: createEmptySession(),
        connected: false,
        runtime: disconnectedRuntime(),
        notice: { level: "error", text: message },
      });
      try {
        onSessionSeedInvalidated?.();
      } catch {
        // This callback is UI bookkeeping, not part of the safety boundary.
      }
    },
    [onSessionSeedInvalidated, store],
  );

  const invalidateGeneration = useCallback(
    async (message: string): Promise<never> => {
      await isolateSession(message);
      throw new Error(message);
    },
    [isolateSession],
  );

  const ensureRuntime = useCallback(async (): Promise<CliRuntimeHandle> => {
    await awaitHealthyLifecycle();
    const state = store.get();
    // The adapter is baked into the booted OS, so a cached handle is only
    // reusable while the LLM settings behind it are unchanged. Keying on them
    // means a `/provider` or `/model` switch — or config hydration finishing
    // after mount — cannot leave a run pointed at the previous endpoint.
    const signature = runtimeSignature(state);
    const cached = runtimeHandleRef.current;
    const cachedWorld = runtimeWorldRef.current;
    const currentWorld = configuredWorld(state);
    const replacingMemoryWorld =
      cached !== null && state.durable === "memory" && runtimeSignatureRef.current !== signature;

    // A cached OS owns private history and open durable handles for exactly one
    // file-world generation. Re-read identity on every start, even when the
    // provider signature is unchanged, so a replaced bundle cannot inherit it.
    if (cachedFileWorldChanged(cached, state.durable, cachedWorld, currentWorld)) {
      return invalidateGeneration(
        "Durable world generation changed; the cached OS and private transcript were isolated",
      );
    }
    if (cached !== null && runtimeSignatureRef.current === signature) {
      return cached;
    }

    // If configuration changed, the old handle must finish shutting down before
    // a replacement is allowed to receive the transcript it owned.
    const seedAuthority = cachedWorld ?? detachedHistoryWorldRef.current ?? sessionSeedWorld;
    // Snapshot from the Boot object before shutdown. Provider/model changes may
    // replace the adapter, but they must not downgrade exact tool evidence into
    // text reconstructed from the UI projection.
    const cachedHistory = cached?.privateHistory() ?? null;
    if (cached !== null) {
      runtimeHandleRef.current = null;
      runtimeSignatureRef.current = null;
      runtimeWorldRef.current = null;
      await shutdownHandle(cached);
      store.set({ connected: false, runtime: disconnectedRuntime() });
    }

    if (replacingMemoryWorld) {
      detachedHistoryRef.current = { messages: [], pendingToolObservations: [] };
      detachedHistoryWorldRef.current = null;
      store.set({
        session: createEmptySession(),
        notice: {
          level: "warn",
          text: "LLM settings changed in memory mode; private and visible history were cleared because the replacement runtime/content world is new.",
        },
      });
    }

    const initialMessages = sessionConversationSeed(store.get().session.messages);
    const exactHistory =
      state.durable === "file"
        ? (cachedHistory ?? detachedHistoryRef.current ?? sessionSeedHistory)
        : null;
    const hasPrivateSeed = exactHistory !== null || initialMessages.length > 0;
    if (privateSeedWorldChanged(state.durable, hasPrivateSeed, seedAuthority, currentWorld)) {
      return invalidateGeneration(
        "Private transcript is not bound to the current durable world generation",
      );
    }

    const checkpointWorld = currentWorld;
    const handle = bootHandle(
      state,
      exactHistory === null ? initialMessages : [],
      exactHistory ?? undefined,
      checkpointHandlerFor(state.durable, checkpointWorld),
    );

    // First boot may create a previously absent file world. Conversely, a
    // concurrent replacement can occur between the preflight read and boot.
    // Re-read after construction and accept only the same verified generation.
    const bootedWorld = configuredWorld(state);
    if (
      bootedFileWorldChanged({
        durable: state.durable,
        bootedWorld,
        currentWorld,
        hasPrivateSeed,
        seedAuthority,
      })
    ) {
      runtimeHandleRef.current = handle;
      return invalidateGeneration(
        "Durable world generation changed while booting; private transcript was not attached",
      );
    }
    runtimeHandleRef.current = handle;
    detachedHistoryRef.current = null;
    detachedHistoryWorldRef.current = null;
    runtimeSignatureRef.current = signature;
    runtimeWorldRef.current = bootedWorld;
    store.set({ connected: true, runtime: handle.syncRuntime() });
    return handle;
  }, [
    awaitHealthyLifecycle,
    checkpointHandlerFor,
    invalidateGeneration,
    sessionSeedHistory,
    sessionSeedWorld,
    shutdownHandle,
    store,
  ]);

  const assertRuntimeGeneration = useCallback(
    async (handle: CliRuntimeHandle): Promise<void> => {
      const state = store.get();
      if (state.durable !== "file") return;
      const currentWorld = configuredWorld(state);
      if (
        runtimeHandleRef.current !== handle ||
        !sessionWorldBindingsEqual(runtimeWorldRef.current, currentWorld)
      ) {
        await invalidateGeneration(
          "Durable world generation changed during the run; cached state was isolated",
        );
      }
    },
    [invalidateGeneration, store],
  );

  const syncRuntime = useCallback(() => {
    const handle = runtimeHandleRef.current;
    if (handle !== null) {
      store.set({ runtime: handle.syncRuntime() });
    }
  }, [store]);

  // Append a lifecycle line to the turn-owning assistant message, located by
  // the anchor recorded at llm_start. Dropped silently if the anchor is gone
  // (e.g. an event arriving after the turn closed). Captured as a useCallback
  // so case handlers below stay small enough to keep cognitive complexity low.
  const appendLifecycle = useCallback(
    (
      stage: LifecycleLine["stage"],
      label: string,
      opts: { coordination?: boolean; detail?: string } = {},
    ) => {
      const anchor = lifecycleAnchorRef.current;
      if (anchor === null) return;
      store.appendLifecycleLine(anchor, {
        stage,
        label,
        ts: Date.now(),
        ...(opts.coordination ? { coordination: true } : {}),
        ...(opts.detail !== undefined ? { detail: opts.detail } : {}),
      });
    },
    [store],
  );

  // Behavior-drift detection: if the model produced text that looks like a tool
  // call it never actually made (e.g. a <done> tag wrapping JSON), surface it
  // explicitly. Otherwise the user sees raw JSON with no explanation of why no
  // tool ran — the "intermediate process not observable" gap.
  const detectAndSurfaceDrift = useCallback(
    (event: Extract<AgentEvent, { kind: "llm_end" }>) => {
      if (event.toolCalls.length > 0 || event.text.length === 0) return;
      const pseudo = detectPseudoToolCall(event.text);
      if (!pseudo.detected) return;
      const detail = `tool=${pseudo.tool ?? "?"}; snippet=${pseudo.snippet}`;
      store.appendTimelineEntry(
        event.turn,
        "diagnostic",
        `Model wrote a pseudo-tool-call (${pseudo.tool ?? "unknown"}) in prose instead of invoking the tool`,
        detail,
      );
      store.appendMessage({
        role: "system",
        content: `模型在文本里写了伪工具调用格式但未真正调用工具；可能因 provider 解析失败回退为纯文本。片段：${pseudo.snippet}`,
        timestamp: Date.now(),
        turn: event.turn,
      });
      appendLifecycle(
        "diagnostic",
        `Pseudo-tool-call (${pseudo.tool ?? "unknown"}) written as prose`,
        {
          detail: pseudo.snippet,
        },
      );
    },
    [appendLifecycle, store],
  );

  // llm_end is the densest case (streaming finalization, usage, drift detection,
  // lifecycle). Extracted so handleEvent stays a thin dispatch.
  const handleLlmEnd = useCallback(
    (event: Extract<AgentEvent, { kind: "llm_end" }>) => {
      if (streamingRef.current) {
        store.updateLastMessage((message) => ({ ...message, streaming: false }));
        streamingRef.current = false;
      }
      // Non-streaming adapter: text arrives whole. Attach to the llm_start
      // bubble (already created) rather than pushing a second message.
      if (event.text.length > 0) {
        store.updateLastMessage((message) => ({ ...message, content: event.text }));
      }
      // Collapse a tool-only turn that produced no prose: an empty assistant
      // bubble with only a lifecycle rail reads cleaner than a blank line.
      if (event.text.trim().length === 0 && event.toolCalls.length > 0) {
        store.updateLastMessage((message) => ({
          ...message,
          streaming: false,
          content: message.content.trim(),
        }));
      }
      if (event.usage !== undefined) {
        const usage = event.usage;
        store.setSession((session) => ({
          tokenUsage: {
            prompt: session.tokenUsage.prompt + usage.prompt,
            completion: session.tokenUsage.completion + usage.completion,
            total: session.tokenUsage.total + usage.total,
          },
        }));
      }
      detectAndSurfaceDrift(event);
      store.appendTimelineEntry(
        event.turn,
        "llm_end",
        event.toolCalls.length > 0
          ? `LLM answered with ${event.toolCalls.length} tool call(s)`
          : "LLM answered (text only)",
      );
      appendLifecycle(
        "llm",
        event.toolCalls.length > 0 ? `LLM → ${event.toolCalls.length} tool call(s)` : "LLM → text",
      );
    },
    [appendLifecycle, detectAndSurfaceDrift, store],
  );

  // tool_start opens a tool card + lifecycle line. Coordination tools (those
  // that route cluster actions rather than read/write content) get a distinct
  // accentAlt marker on both the card and the rail.
  const handleToolStart = useCallback(
    (event: Extract<AgentEvent, { kind: "tool_start" }>) => {
      const coordination = "coordination" in event && event.coordination === true;
      const card: ToolCallDisplay = {
        id: event.toolCallId,
        name: event.name,
        args: event.arguments,
        status: "running",
        startedAt: Date.now(),
        ...(coordination ? { coordination: true } : {}),
      };
      store.set({
        phase: { kind: "tool", turn: event.turn, name: event.name, since: Date.now() },
      });
      store.appendMessage({
        role: "system",
        content: "",
        toolCalls: [card],
        timestamp: Date.now(),
        turn: event.turn,
      });
      store.appendTimelineEntry(event.turn, "tool_start", `▶ ${event.name}`);
      appendLifecycle("tool_start", event.name, { coordination });
    },
    [appendLifecycle, store],
  );

  // tool_end patches the matching card with its result, syncs the runtime, and
  // emits a lifecycle line — with a failure detail so a failed coordination
  // action is readable on the rail, not only on the card.
  const handleToolEnd = useCallback(
    (event: Extract<AgentEvent, { kind: "tool_end" }>) => {
      const coordination = "coordination" in event && event.coordination === true;
      store.updateLastMessage((message) => {
        const cards = message.toolCalls;
        if (cards === undefined) return message;
        return {
          ...message,
          toolCalls: cards.map((card) =>
            card.id === event.toolCallId
              ? {
                  ...card,
                  status: event.ok ? ("done" as const) : ("error" as const),
                  result: { ok: event.ok, output: event.output },
                  endedAt: Date.now(),
                }
              : card,
          ),
        };
      });
      syncRuntime();
      store.appendTimelineEntry(event.turn, "tool_end", `${event.ok ? "✓" : "✗"} ${event.name}`);
      appendLifecycle("tool_end", event.name, {
        coordination,
        ...(event.ok ? {} : { detail: event.output }),
      });
    },
    [appendLifecycle, store, syncRuntime],
  );

  const handleEvent = useCallback(
    (event: AgentEvent): void => {
      switch (event.kind) {
        case "turn_start":
          store.set({
            phase: { kind: "perceiving", turn: event.turn },
            session: { ...store.get().session, turnCount: event.turn },
          });
          store.appendTimelineEntry(event.turn, "turn_start", `Turn ${event.turn} start`);
          // Clear any stale anchor from a prior turn before llm_start sets a new
          // one; the rail is per-turn, not cross-turn.
          lifecycleAnchorRef.current = null;
          break;

        case "llm_start": {
          store.set({ phase: { kind: "thinking", turn: event.turn, since: Date.now() } });
          streamingRef.current = false;
          // Open a turn-owning assistant bubble at llm_start, not llm_delta, so a
          // tool-only turn (no streamed text) still gets a lifecycle rail. Content
          // stays empty until deltas arrive; llm_end collapses empty tool-only
          // turns so the rail is the only thing that bubble renders.
          const anchorTs = Date.now();
          lifecycleAnchorRef.current = anchorTs;
          store.appendMessage({
            role: "assistant",
            content: "",
            timestamp: anchorTs,
            streaming: true,
            turn: event.turn,
          });
          store.appendTimelineEntry(event.turn, "llm_start", "LLM thinking");
          appendLifecycle("turn_open", `Turn ${event.turn} open`);
          appendLifecycle("llm", "LLM thinking");
          break;
        }

        case "llm_delta":
          // The assistant bubble was already opened at llm_start. Grow it in place.
          if (!streamingRef.current) {
            streamingRef.current = true;
          }
          store.updateLastMessage((message) => ({
            ...message,
            content: message.content + event.text,
          }));
          break;

        case "llm_end":
          handleLlmEnd(event);
          break;

        case "tool_start":
          handleToolStart(event);
          break;

        case "tool_end":
          handleToolEnd(event);
          break;

        case "turn_end":
          store.set({ phase: { kind: "idle" } });
          syncRuntime();
          store.appendTimelineEntry(event.turn, "turn_end", `Turn ${event.turn} end`);
          appendLifecycle("turn_close", `Turn ${event.turn} end`);
          lifecycleAnchorRef.current = null;
          break;

        case "control_verdict":
          // The verdict is surfaced to observers via the transcript (the loop's
          // own control_verdict event) and via the phase changes each turn already
          // drives. No extra store mutation is needed here; the ASK_USER case is
          // the one that needs a dedicated pause surface, handled by ask_user.
          store.appendTimelineEntry(
            event.turn,
            "control_verdict",
            `Control verdict: ${event.verdict.kind}`,
          );
          appendLifecycle("diagnostic", `Control verdict: ${event.verdict.kind}`);
          break;

        case "ask_user": {
          // The loop is now paused on the onAskUser promise this hook returned.
          // Surface the question to the TUI; the App resolves pendingAsk and the
          // resolver below fires, unblocking the loop with the user's reply.
          store.set({
            mode: "ask",
            phase: { kind: "asking", turn: event.turn },
            pendingAsk: {
              question: event.question,
              ...(event.options === undefined ? {} : { options: event.options }),
              answer: (reply) => {
                askResolverRef.current?.(reply);
              },
            },
          });
          store.appendTimelineEntry(event.turn, "ask_user", `ASK_USER: ${event.question}`);
          appendLifecycle("diagnostic", `ASK_USER: ${event.question}`);
          break;
        }

        case "error":
          store.appendMessage({
            role: "error",
            content: `${event.phase}: ${event.message}`,
            timestamp: Date.now(),
            turn: event.turn,
          });
          store.set({
            phase: { kind: "idle" },
            notice: { level: "error", text: event.message },
          });
          store.appendTimelineEntry(
            event.turn,
            "error",
            `✗ ${event.phase}: ${event.message}`,
            event.detail,
          );
          appendLifecycle("error", `${event.phase}: ${event.message}`, {
            ...(event.detail !== undefined ? { detail: event.detail } : {}),
          });
          break;

        case "diagnostic":
          // Non-fatal observations (skipped stream frames, provider drift,
          // pseudo-tool-calls) are surfaced as timeline entries. The
          // pseudo-tool-call case also adds a transcript message in llm_end;
          // stream diagnostics only need the timeline.
          store.appendTimelineEntry(event.turn, "diagnostic", `⚠ ${event.message}`, event.detail);
          appendLifecycle("diagnostic", event.message, {
            ...(event.detail !== undefined ? { detail: event.detail } : {}),
          });
          break;

        default:
          // Compile-time exhaustiveness guard; unreachable at runtime.
          event satisfies never;
          break;
      }
    },
    [appendLifecycle, handleLlmEnd, handleToolEnd, handleToolStart, store, syncRuntime],
  );

  const start = useCallback(
    async (instruction: string): Promise<RunResult | undefined> => {
      if (startInFlightRef.current || running) return undefined;
      startInFlightRef.current = true;

      // Fail here rather than letting the provider answer with a 401 whose text
      // points at the wrong vendor's dashboard.
      const missingKey = missingApiKeyVar(store.get().provider);
      if (missingKey !== null) {
        const text = `${missingKey} is not set — export it, then retry (\`/provider\` to switch)`;
        store.appendMessage({ role: "user", content: instruction, timestamp: Date.now() });
        store.appendMessage({ role: "error", content: text, timestamp: Date.now() });
        store.set({ notice: { level: "error", text: `${missingKey} is not set` } });
        startInFlightRef.current = false;
        return undefined;
      }

      setRunning(true);
      const generation = ++runGenerationRef.current;
      streamingRef.current = false;
      lifecycleAnchorRef.current = null;
      store.set({ agentRunning: true, notice: null });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Seed a newly booted runtime from the *previous* transcript. Appending
        // the current prompt first would seed it once here and then run() would
        // append the same instruction a second time to private history.
        const handle = await ensureRuntime();
        checkpointGenerationRef.current = generation;
        store.appendMessage({ role: "user", content: instruction, timestamp: Date.now() });
        const result = await handle.os.run(instruction, {
          signal: controller.signal,
          onEvent: (event) => {
            if (runGenerationRef.current === generation) handleEvent(event);
          },
          // The controller pauses the loop on this promise when it verdicts
          // ASK_USER. The ask_user event (dispatched just before boot awaits
          // this) sets store.pendingAsk, whose resolver fires
          // askResolverRef.current with the user's reply. A stale/aborted run
          // resolves with an empty answer so the loop does not hang.
          onAskUser: (_question, _options) =>
            new Promise<string>((resolve) => {
              const settle = (reply: string): void => {
                askResolverRef.current = null;
                controller.signal.removeEventListener("abort", onAbort);
                store.set({ pendingAsk: null, mode: "chat" });
                // Surface the user's answer in the transcript so it is not
                // silently injected into private history alone.
                store.appendMessage({ role: "user", content: reply, timestamp: Date.now() });
                resolve(reply);
              };
              const onAbort = (): void => {
                // An abort during an ASK_USER pause must unblock the loop; boot's
                // `await onAskUser` does not observe the run signal itself.
                if (askResolverRef.current !== null) settle("");
              };
              askResolverRef.current = settle;
              controller.signal.addEventListener("abort", onAbort, { once: true });
              // If the generation is already stale by the time the ask lands,
              // resolve immediately so the loop does not wait on a dead ref.
              if (runGenerationRef.current !== generation || controller.signal.aborted) {
                settle("");
              }
              // The question/options are surfaced to the TUI by the ask_user
              // event handler (which sets store.pendingAsk); they are not needed
              // here because the event arrives before boot awaits this promise.
            }),
        });

        if (runGenerationRef.current !== generation) return result;
        await assertRuntimeGeneration(handle);

        store.set({ runtime: handle.syncRuntime(), phase: { kind: "idle" } });
        store.setSession({ turnCount: result.turns });

        // Only surface the summary when it adds something beyond the streamed prose.
        const last = store.get().session.messages.at(-1);
        if (last?.role !== "assistant" || last.content.trim() !== result.summary.trim()) {
          store.appendMessage({
            role: result.ok ? "assistant" : "error",
            content: result.summary,
            timestamp: Date.now(),
          });
        }
        return result;
      } catch (error) {
        if (runGenerationRef.current !== generation) return undefined;
        store.appendMessage({
          role: "error",
          content: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
        store.set({
          notice: {
            level: "error",
            text: error instanceof Error ? error.message : String(error),
          },
        });
        return undefined;
      } finally {
        startInFlightRef.current = false;
        if (runGenerationRef.current === generation) {
          store.set({ agentRunning: false, phase: { kind: "idle" } });
          setRunning(false);
          abortRef.current = null;
          streamingRef.current = false;
        }
      }
    },
    [assertRuntimeGeneration, ensureRuntime, handleEvent, running, store],
  );

  const abort = useCallback(() => {
    runGenerationRef.current++;
    abortRef.current?.abort();
    store.set({
      agentRunning: false,
      phase: { kind: "idle" },
      pendingAsk: null,
      notice: { level: "warn", text: "Aborted" },
    });
    streamingRef.current = false;
    lifecycleAnchorRef.current = null;
    setRunning(false);
  }, [store]);

  const stop = useCallback(
    async (mode: "preserve" | "clear" = "preserve"): Promise<RuntimeResetResult> => {
      runGenerationRef.current++;
      abortRef.current?.abort();
      const state = store.get();
      const cached = runtimeHandleRef.current;
      const outcome = runtimeResetOutcome(mode, state.durable);
      if (outcome.history === "preserved") {
        detachedHistoryRef.current = cached?.privateHistory() ?? detachedHistoryRef.current;
        detachedHistoryWorldRef.current =
          runtimeWorldRef.current ?? detachedHistoryWorldRef.current;
      } else {
        detachedHistoryRef.current = { messages: [], pendingToolObservations: [] };
        detachedHistoryWorldRef.current = null;
      }
      runtimeHandleRef.current = null;
      runtimeSignatureRef.current = null;
      runtimeWorldRef.current = null;
      abortRef.current = null;
      streamingRef.current = false;
      askResolverRef.current = null;
      lifecycleAnchorRef.current = null;
      setRunning(false);
      applyStoppedRuntimeState(store, outcome);

      if (cached === null) {
        await lifecycleFlightRef.current;
        return outcome;
      }
      await shutdownHandle(cached);
      return outcome;
    },
    [shutdownHandle, store],
  );

  const sessionWorld = useCallback(
    (): SessionWorldBinding | null =>
      runtimeWorldRef.current ?? detachedHistoryWorldRef.current ?? sessionSeedWorld,
    [sessionSeedWorld],
  );

  const privateHistory = useCallback(
    (): AgentLoopHistory | null =>
      runtimeHandleRef.current?.privateHistory() ?? detachedHistoryRef.current,
    [],
  );

  const runtimeBackends = useCallback((): {
    readonly contentStore: ContentStore | undefined;
    readonly syscallRuntime: ReturnType<CliRuntimeHandle["syscallRuntime"]> | undefined;
    readonly storagePath: string | undefined;
  } => {
    const handle = runtimeHandleRef.current;
    if (handle === null) {
      return { contentStore: undefined, syscallRuntime: undefined, storagePath: undefined };
    }
    return {
      contentStore: handle.contentStore(),
      syscallRuntime: handle.syscallRuntime(),
      storagePath: handle.storagePath(),
    };
  }, []);

  return {
    running,
    start,
    stop,
    abort,
    sessionWorld,
    privateHistory,
    isolateSession,
    runtimeBackends,
  };
}
