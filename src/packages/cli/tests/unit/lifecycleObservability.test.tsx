// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { inkInputHandlers } from "../setup/inkSetup.js";
import { ReactiveStore } from "../../src/store.js";
import type { AgentEvent, AgentLoopHistory, RunResult } from "@cantilune/boot";

// Mocks must be declared BEFORE the vi.mock calls so the hoisted factories
// capture initialized bindings (vitest auto-hoists identifiers named `*Mock`).
const runMock = vi.fn(
  async (_instruction: string, options: { onEvent?: (e: AgentEvent) => void }) => {
    capturedOnEvent = options.onEvent ?? null;
    return new Promise<RunResult>((resolve) => {
      resolveRun = resolve;
    });
  },
);
const shutdownMock = vi.fn(async () => undefined);
const historyMock = vi.fn<() => AgentLoopHistory | null>(() => ({
  messages: [],
  pendingToolObservations: [],
}));

vi.mock("@cantilune/adapter", () => ({
  createAdapter: vi.fn(() => ({})),
  createEmbedder: vi.fn(() => undefined),
}));

vi.mock("../../src/runtimeSync.js", () => ({
  buildLlmConfig: vi.fn(() => ({ provider: "openai", model: "gpt-4o" })),
  missingApiKeyVar: vi.fn(() => null),
  createCliRuntimeBoot: vi.fn(() => ({
    os: { run: runMock, shutdown: shutdownMock },
    privateHistory: historyMock,
    syncRuntime: vi.fn(() => ({ snapshot: null, changeLog: [], epoch: null })),
    shutdown: shutdownMock,
  })),
}));

import { useAgentLoop } from "../../src/tui/hooks/useAgentLoop.js";

/** Captured onEvent callback the hook passes into the mocked `os.run`. */
let capturedOnEvent: ((event: AgentEvent) => void) | null = null;
let resolveRun: ((value: RunResult) => void) | null = null;
/** The pending start() promise; resolved once the mocked os.run resolves. */
let pendingStart: Promise<RunResult | undefined> | null = null;

function emit(event: AgentEvent): void {
  if (capturedOnEvent === null) throw new Error("onEvent not captured");
  act(() => capturedOnEvent!(event));
}

// Typed event builders. boot's AgentEvent is readonly with exactOptionalPropertyTypes,
// so omit optional fields entirely rather than passing `undefined`, and include the
// required fields (turn_start.elapsedMs, turn_end.elapsedMs + lastAction) the test
// otherwise wouldn't care about.
const ev = {
  turnStart: (turn: number): AgentEvent => ({ kind: "turn_start", turn, elapsedMs: 1 }),
  llmStart: (turn: number): AgentEvent => ({ kind: "llm_start", turn }),
  llmDelta: (turn: number, text: string): AgentEvent => ({ kind: "llm_delta", turn, text }),
  llmEnd: (turn: number, text: string, toolCalls: readonly never[] = []): AgentEvent => ({
    kind: "llm_end",
    turn,
    text,
    toolCalls,
  }),
  turnEnd: (turn: number, lastAction = "done"): AgentEvent => ({
    kind: "turn_end",
    turn,
    elapsedMs: 1,
    lastAction,
  }),
  toolStart: (
    turn: number,
    id: string,
    name: string,
    args: Record<string, unknown>,
    coordination?: boolean,
  ): AgentEvent => ({
    kind: "tool_start",
    turn,
    toolCallId: id,
    name,
    arguments: args,
    ...(coordination ? { coordination: true } : {}),
  }),
  toolEnd: (
    turn: number,
    id: string,
    name: string,
    ok: boolean,
    output: string,
    coordination?: boolean,
  ): AgentEvent => ({
    kind: "tool_end",
    turn,
    toolCallId: id,
    name,
    ok,
    output,
    ...(coordination ? { coordination: true } : {}),
  }),
  error: (
    turn: number,
    phase: string,
    message: string,
    detail?: string,
  ): AgentEvent => ({
    kind: "error",
    turn,
    phase: phase as never,
    message,
    retryable: false,
    ...(detail !== undefined ? { detail } : {}),
  }),
};

/**
 * Fire start() and wait for the mocked os.run to capture onEvent. start()
 * awaits ensureRuntime() before calling run(), so onEvent is not captured
 * synchronously — pump the microtask queue until it is.
 */
async function startAndCapture(
  result: { current: { start: (instruction: string) => Promise<RunResult | undefined> } },
  instruction: string,
): Promise<void> {
  act(() => {
    pendingStart = result.current.start(instruction);
  });
  for (let i = 0; i < 50 && capturedOnEvent === null; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  if (capturedOnEvent === null) throw new Error("os.run did not capture onEvent");
}

/** Resolve the mocked os.run and let start()'s post-run bookkeeping settle. */
async function finishRun(result: RunResult): Promise<void> {
  act(() => resolveRun?.(result));
  await Promise.resolve();
  await act(async () => {
    await pendingStart;
  });
}

function createMemoryStore(): ReactiveStore {
  return new ReactiveStore({
    durable: "memory",
    storagePath: undefined,
    principalId: undefined,
  });
}

const TURN_RESULT: RunResult = {
  ok: true,
  summary: "Turn complete",
  turns: 1,
  elapsedMs: 10,
  producedRefs: [],
  operations: { committed: 0, rejected: 0 },
};

describe("lifecycle observability (default transcript)", () => {
  beforeEach(() => {
    inkInputHandlers.length = 0;
    capturedOnEvent = null;
    resolveRun = null;
    pendingStart = null;
    runMock.mockClear();
    shutdownMock.mockClear();
    historyMock.mockClear();
    historyMock.mockReturnValue({ messages: [], pendingToolObservations: [] });
  });

  it("attaches a lifecycle rail to the turn-owning assistant message", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    // Fire start and wait for os.run to capture onEvent (start awaits
    // ensureRuntime before calling run, so capture is not synchronous).
    await startAndCapture(result, "prove a small fact");

    emit(ev.turnStart(1));
    emit(ev.llmStart(1));
    emit(ev.llmDelta(1, "thinking"));
    emit(ev.llmEnd(1, "thinking"));
    emit(ev.turnEnd(1));

    await finishRun(TURN_RESULT);

    const assistant = store
      .get()
      .session.messages.find((m) => m.role === "assistant" && (m.lifecycle?.length ?? 0) > 0);
    expect(assistant).toBeDefined();
    const stages = assistant!.lifecycle!.map((l) => l.stage);
    expect(stages).toContain("turn_open");
    expect(stages).toContain("llm");
    expect(stages).toContain("turn_close");
  });

  it("records tool_start/tool_end lifecycle lines and reads the coordination flag", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await startAndCapture(result, "introduce an artifact");

    emit(ev.turnStart(1));
    emit(ev.llmStart(1));
    emit(ev.toolStart(1, "t1", "introduce_artifact", { x: 1 }, true));
    emit(ev.toolEnd(1, "t1", "introduce_artifact", true, "committed", true));
    emit(ev.toolStart(1, "t2", "read_content", { ref: "sha256:x" }));
    emit(ev.toolEnd(1, "t2", "read_content", true, "data"));
    emit(ev.turnEnd(1));
    await finishRun(TURN_RESULT);

    const assistant = store
      .get()
      .session.messages.find((m) => m.role === "assistant" && (m.lifecycle?.length ?? 0) > 0);
    const toolLines = assistant!.lifecycle!.filter(
      (l) => l.stage === "tool_start" || l.stage === "tool_end",
    );
    const coordinationLines = toolLines.filter((l) => l.coordination === true);
    const plainLines = toolLines.filter((l) => l.coordination !== true);
    expect(coordinationLines).toHaveLength(2);
    expect(plainLines).toHaveLength(2);
    expect(coordinationLines.every((l) => l.label === "introduce_artifact")).toBe(true);
  });

  it("marks the ToolCard display with coordination for coordination tool calls", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await startAndCapture(result, "fork a branch");

    emit(ev.turnStart(1));
    emit(ev.llmStart(1));
    emit(ev.toolStart(1, "t1", "fork_branch", { from: "x" }, true));
    emit(ev.turnEnd(1));
    await finishRun(TURN_RESULT);

    const toolMessage = store
      .get()
      .session.messages.find((m) => m.toolCalls?.some((c) => c.id === "t1"));
    const card = toolMessage?.toolCalls?.find((c) => c.id === "t1");
    expect(card?.coordination).toBe(true);
  });

  it("does not set coordination on a plain tool: external tool card", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await startAndCapture(result, "run a search");

    emit(ev.turnStart(1));
    emit(ev.llmStart(1));
    emit(ev.toolStart(1, "t1", "tool:search", { q: "x" }));
    emit(ev.turnEnd(1));
    await finishRun(TURN_RESULT);

    const card = store
      .get()
      .session.messages.flatMap((m) => m.toolCalls ?? [])
      .find((c) => c.id === "t1");
    expect(Object.prototype.hasOwnProperty.call(card, "coordination")).toBe(false);
  });

  it("emits a diagnostic lifecycle line for a pseudo-tool-call in prose", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await startAndCapture(result, "summarize");

    emit(ev.turnStart(1));
    emit(ev.llmStart(1));
    emit(ev.llmEnd(1, 'here is my done call <done>{"summary":"finished"}</done>'));
    emit(ev.turnEnd(1));
    await finishRun(TURN_RESULT);

    const assistant = store
      .get()
      .session.messages.find((m) => m.role === "assistant" && (m.lifecycle?.length ?? 0) > 0);
    const diagLines = assistant!.lifecycle!.filter((l) => l.stage === "diagnostic");
    expect(diagLines.length).toBeGreaterThan(0);
    expect(diagLines.some((l) => l.detail !== undefined)).toBe(true);
  });

  it("logs every event kind to the eventLog ring buffer", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await startAndCapture(result, "multi-step");

    emit(ev.turnStart(1));
    emit(ev.llmStart(1));
    emit(ev.llmEnd(1, ""));
    emit(ev.toolStart(1, "t1", "done", {}));
    emit(ev.toolEnd(1, "t1", "done", true, "ok"));
    emit(ev.turnEnd(1));
    await finishRun(TURN_RESULT);

    const kinds = store.get().eventLog.map((e) => e.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "turn_start",
        "llm_start",
        "llm_end",
        "tool_start",
        "tool_end",
        "turn_end",
      ]),
    );
    const seqs = store.get().eventLog.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it("emits an error lifecycle line with detail on an error event", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await startAndCapture(result, "failing task");

    emit(ev.turnStart(1));
    emit(ev.llmStart(1));
    emit(ev.error(1, "tool", "dispatch failed", "stack trace here"));
    emit(ev.turnEnd(1));
    await finishRun(TURN_RESULT);

    const assistant = store
      .get()
      .session.messages.find((m) => m.role === "assistant" && (m.lifecycle?.length ?? 0) > 0);
    const errLine = assistant!.lifecycle!.find((l) => l.stage === "error");
    expect(errLine).toBeDefined();
    expect(errLine?.detail).toContain("stack trace");
  });
});
