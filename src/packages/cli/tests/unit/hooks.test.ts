// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { inkInputHandlers } from "../setup/inkSetup.js";
import { createStore, ReactiveStore } from "../../src/store.js";
import { useSlashCommands } from "../../src/tui/hooks/useSlashCommands.js";
import { useKeyboard } from "../../src/tui/hooks/useKeyboard.js";
import { usePerception } from "../../src/tui/hooks/usePerception.js";
import type { RunResult } from "@cantilune/boot";
import type { AgentLoopHistory } from "@cantilune/boot";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { collaborationSnapshot, epochId, snapshotRef } from "@cantilune/core";
import { createFileRuntimePersistence } from "@cantilune/runtime/memory";

const runMock = vi.fn();
const shutdownMock = vi.fn(async () => undefined);
const historyMock = vi.fn<() => AgentLoopHistory | null>(() => ({
  messages: [],
  pendingToolObservations: [],
}));

vi.mock("@cantilune/adapter", () => ({
  createAdapter: vi.fn(() => ({})),
  // The controller's optional embedding sensor; returning undefined makes the
  // residual engine degrade to its Jaccard fallback, which is the correct
  // behavior in a unit test that never exercises real embeddings.
  createEmbedder: vi.fn(() => undefined),
}));

vi.mock("../../src/runtimeSync.js", () => ({
  buildLlmConfig: vi.fn(() => ({ provider: "openai", model: "gpt-4o" })),
  // These hooks run without real credentials, so the pre-run key check has to
  // report "nothing missing" for the loop under test to proceed.
  missingApiKeyVar: vi.fn(() => null),
  createCliRuntimeBoot: vi.fn(() => ({
    os: {
      run: runMock,
      shutdown: shutdownMock,
    },
    privateHistory: historyMock,
    syncRuntime: vi.fn(() => ({ snapshot: null, changeLog: [], epoch: null })),
    shutdown: shutdownMock,
  })),
}));

import {
  createSessionWorldBinding,
  sessionWorldBindingsEqual,
  useSession,
  type SessionWorldBinding,
} from "../../src/tui/hooks/useSession.js";
import { createCliRuntimeBoot } from "../../src/runtimeSync.js";
import { sessionConversationSeed, useAgentLoop } from "../../src/tui/hooks/useAgentLoop.js";

function initializeFileWorld(storagePath: string, genesisRef = "genesis-a"): void {
  createFileRuntimePersistence({
    dir: path.join(storagePath, "runtime"),
    initial: collaborationSnapshot({
      snapshotRef: snapshotRef(genesisRef),
      epochId: epochId("epoch-a"),
    }),
  });
}

function createMemoryStore(): ReactiveStore {
  return new ReactiveStore({
    durable: "memory",
    storagePath: undefined,
    principalId: undefined,
  });
}

async function replaceFileWorld(storagePath: string, genesisRef: string): Promise<void> {
  await rm(path.join(storagePath, "runtime"), { recursive: true, force: true });
  initializeFileWorld(storagePath, genesisRef);
}

describe("tui hooks", () => {
  beforeEach(() => {
    inkInputHandlers.length = 0;
    runMock.mockReset();
    shutdownMock.mockClear();
    historyMock.mockClear();
    historyMock.mockReturnValue({ messages: [], pendingToolObservations: [] });
    vi.mocked(createCliRuntimeBoot).mockClear();
    runMock.mockResolvedValue({
      ok: true,
      summary: "done",
      turns: 2,
      elapsedMs: 12,
      producedRefs: [],
    });
  });

  it("useSlashCommands registers builtins and executes", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useSlashCommands({ store }));
    expect(result.current.commands.some((c) => c.name === "/world")).toBe(true);
    await act(async () => {
      await result.current.execute("/world");
    });
    expect(store.get().activeView).toBe("world");
    await act(async () => {
      await result.current.execute("/chat");
    });
    expect(store.get().activeView).toBeNull();
    expect(result.current.find("graph").length).toBeGreaterThan(0);
    expect(result.current.names).toContain("/world");
  });

  it("useSlashCommands routes side effects through services", async () => {
    const store = createMemoryStore();
    const persistConfig = vi.fn(async () => undefined);
    const resetRuntime = vi.fn(async () => undefined);
    const notify = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ store, services: { persistConfig, resetRuntime, notify } }),
    );

    await act(async () => {
      await result.current.execute("/provider anthropic");
    });

    expect(store.get().provider).toBe("anthropic");
    expect(resetRuntime).toHaveBeenCalled();
    expect(persistConfig).toHaveBeenCalledWith(expect.objectContaining({ provider: "anthropic" }));
    expect(notify).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("anthropic"));
  });

  it("useKeyboard handles abort, layout toggle, and escape", () => {
    const store = new ReactiveStore({ mode: "view", activeView: "world", agentRunning: true });
    const onAbort = vi.fn();
    renderHook(() =>
      useKeyboard(store, {
        onAbort,
        onScrollReset: vi.fn(),
      }),
    );
    const handler = inkInputHandlers.at(-1)!;

    handler("", { escape: true });
    expect(store.get().mode).toBe("chat");

    handler("o", { ctrl: true });
    expect(store.get().layout).toBe("observe");
    handler("o", { ctrl: true });
    expect(store.get().layout).toBe("focus");

    // Ctrl+C interrupts the run rather than exiting while an agent is active.
    handler("c", { ctrl: true });
    expect(onAbort).toHaveBeenCalled();
  });

  it("useKeyboard respects disabled flag", () => {
    const store = new ReactiveStore({ mode: "view", activeView: "world" });
    renderHook(() => useKeyboard(store, { enabled: false }));
    const handler = inkInputHandlers.at(-1)!;
    handler("", { escape: true });
    expect(store.get().mode).toBe("view");
  });

  it("usePerception polls and ignores failures", async () => {
    vi.useFakeTimers();
    const onSnapshot = vi.fn();
    renderHook(() =>
      usePerception({
        intervalMs: 1000,
        perceive: async () => ({ timestamp: 1, summary: "ok" }),
        onSnapshot,
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSnapshot).toHaveBeenCalled();

    renderHook(() =>
      usePerception({
        enabled: false,
        perceive: () => ({ timestamp: 2, summary: "x" }),
        onSnapshot,
      }),
    );

    renderHook(() =>
      usePerception({
        perceive: async () => {
          throw new Error("fail");
        },
        onSnapshot,
      }),
    );
    const { unmount } = renderHook(() =>
      usePerception({
        intervalMs: 500,
        perceive: async () => ({ timestamp: 3, summary: "tick" }),
        onSnapshot,
      }),
    );
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    vi.useRealTimers();
  });

  it("useSession loads, saves, and clears", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-"));
    const storagePath = path.join(dir, "world-a");
    initializeFileWorld(storagePath);
    const world = createSessionWorldBinding({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    });
    expect(world).not.toBeNull();

    const { result } = renderHook(() => useSession(dir));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const next = { ...createStore().session, turnCount: 5 };
    await act(async () => {
      await result.current.save(next, { messages: [], pendingToolObservations: [] }, world!);
    });
    expect(result.current.restoreFor(world)?.session.turnCount).toBe(5);

    await act(async () => {
      await result.current.clear(world!);
    });
    expect(result.current.restoreFor(world)?.session.turnCount).toBe(0);
    expect(result.current.world).toEqual(world);
  });

  it("derives an exact durable, path, principal, and genesis identity", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-world-"));
    const relativePath = path.join(dir, "world-a");
    expect(
      createSessionWorldBinding({
        durable: "file",
        storagePath: path.join(dir, "missing-world"),
        principalId: "agent-a",
      }),
    ).toBeNull();
    initializeFileWorld(relativePath, "genesis-a");
    const fileWorld = createSessionWorldBinding({
      durable: "file",
      storagePath: relativePath,
      principalId: "agent-a",
    });

    expect(fileWorld).toEqual({
      durable: "file",
      storagePath: path.resolve(relativePath),
      principalId: "agent-a",
      genesisRef: "genesis-a",
    });
    expect(createSessionWorldBinding({ durable: "file", principalId: "agent-a" })).toBeNull();
    expect(createSessionWorldBinding({ durable: "file", storagePath: relativePath })).toBeNull();
    expect(
      createSessionWorldBinding({
        durable: "memory",
        storagePath: relativePath,
        principalId: "agent-a",
      }),
    ).toBeNull();
    expect(
      sessionWorldBindingsEqual(
        fileWorld,
        createSessionWorldBinding({
          durable: "file",
          storagePath: relativePath,
          principalId: "agent-b",
        }),
      ),
    ).toBe(false);
  });

  it("rejects a forged ephemeral binding at the persistence boundary", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-"));
    const { result } = renderHook(() => useSession(dir));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const forged = {
      durable: "memory",
      storagePath: path.join(dir, "ephemeral"),
      principalId: "agent-a",
      genesisRef: "forged",
    } as unknown as SessionWorldBinding;
    await expect(
      result.current.save(
        createStore().session,
        { messages: [], pendingToolObservations: [] },
        forged,
      ),
    ).rejects.toThrow("canonical file-world generation");
  });

  it("useAgentLoop runs, aborts, and stops", async () => {
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));

    let first: unknown;
    await act(async () => {
      first = await result.current.start("do task");
    });
    expect(first).toMatchObject({ ok: true });
    expect(store.get().connected).toBe(true);
    expect(store.get().session.messages.some((m) => m.role === "user")).toBe(true);

    await act(async () => {
      result.current.abort();
      await result.current.stop();
    });
    expect(shutdownMock).toHaveBeenCalled();
    expect(store.get().connected).toBe(false);
  });

  it("seeds a new runtime from prior conversation without duplicating the current prompt", async () => {
    const store = createMemoryStore();
    store.appendMessage({ role: "user", content: "earlier request", timestamp: 1 });
    store.appendMessage({ role: "assistant", content: "earlier result", timestamp: 2 });
    store.appendMessage({ role: "error", content: "display-only failure", timestamp: 3 });
    const { result } = renderHook(() => useAgentLoop({ store }));

    await act(async () => {
      await result.current.start("current request");
    });

    const bootConfig = vi.mocked(createCliRuntimeBoot).mock.calls[0]?.[1];
    expect(bootConfig?.initialMessages).toEqual([
      { role: "user", content: "earlier request" },
      { role: "assistant", content: "earlier result" },
    ]);
    expect(
      bootConfig?.initialMessages?.filter(
        (message) => message.role === "user" && message.content === "current request",
      ),
    ).toHaveLength(0);
  });

  it("clears exact and visible history across a memory adapter configuration restart", async () => {
    const exact: AgentLoopHistory = {
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "write-1", name: "write_content", arguments: '{"content":"x"}' }],
        },
        {
          role: "tool",
          toolCallId: "write-1",
          content:
            "Written. ref=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
      pendingToolObservations: [],
    };
    historyMock.mockReturnValue(exact);
    const store = createMemoryStore();
    const hook = renderHook(() => useAgentLoop({ store }));

    await act(async () => {
      await hook.result.current.start("first");
    });
    await act(async () => {
      await hook.result.current.stop("preserve");
    });
    expect(store.get().session.messages).toEqual([]);
    expect(store.get().notice?.text).toContain("replacement runtime/content world is new");
    store.set({ model: "replacement-model" });
    await act(async () => {
      await hook.result.current.start("second");
    });

    expect(createCliRuntimeBoot).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createCliRuntimeBoot).mock.calls[1]?.[1]).toMatchObject({
      initialMessages: [],
    });
    expect(vi.mocked(createCliRuntimeBoot).mock.calls[1]?.[1]).not.toHaveProperty("history");
    expect(shutdownMock).toHaveBeenCalledOnce();
  });

  it("does not inherit prior private history after an explicit clear reset", async () => {
    const exact: AgentLoopHistory = {
      messages: [{ role: "assistant", content: "private prior answer" }],
      pendingToolObservations: [],
    };
    historyMock.mockReturnValue(exact);
    const store = createMemoryStore();
    const hook = renderHook(() => useAgentLoop({ store }));
    await act(async () => {
      await hook.result.current.start("first");
    });

    await act(async () => {
      await hook.result.current.stop("clear");
      store.setSession({ messages: [], turnCount: 0 });
    });
    await act(async () => {
      await hook.result.current.start("after clear");
    });

    expect(vi.mocked(createCliRuntimeBoot).mock.calls[1]?.[1]).toMatchObject({
      initialMessages: [],
    });
    expect(vi.mocked(createCliRuntimeBoot).mock.calls[1]?.[1]).not.toHaveProperty("history");
  });

  it("preserves exact Boot history across a same-generation file adapter restart", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-file-provider-reset-"));
    const storagePath = path.join(dir, "world");
    initializeFileWorld(storagePath, "genesis-file-reset");
    const exact: AgentLoopHistory = {
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "write-file", name: "write_content", arguments: '{"content":"x"}' }],
        },
        {
          role: "tool",
          toolCallId: "write-file",
          content:
            "Written. ref=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
      pendingToolObservations: [],
    };
    historyMock.mockReturnValue(exact);
    const store = new ReactiveStore({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    });
    const hook = renderHook(() => useAgentLoop({ store }));

    await act(async () => {
      await hook.result.current.start("first");
      await hook.result.current.stop("preserve");
    });
    store.set({ model: "replacement-model" });
    await act(async () => {
      await hook.result.current.start("second");
    });

    expect(vi.mocked(createCliRuntimeBoot).mock.calls[1]?.[1]).toMatchObject({
      history: exact,
      initialMessages: [],
    });
    expect(shutdownMock).toHaveBeenCalledOnce();

    hook.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("awaits shutdown before a replacement runtime can boot", async () => {
    let finishShutdown!: () => void;
    shutdownMock.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finishShutdown = () => {
            resolve(undefined);
          };
        }),
    );
    const store = createMemoryStore();
    const hook = renderHook(() => useAgentLoop({ store }));
    await act(async () => {
      await hook.result.current.start("first");
    });

    let reset!: ReturnType<typeof hook.result.current.stop>;
    let replacement!: Promise<RunResult | undefined>;
    act(() => {
      reset = hook.result.current.stop("preserve");
      store.set({ model: "replacement-model" });
      replacement = hook.result.current.start("second");
    });
    await Promise.resolve();
    expect(createCliRuntimeBoot).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledTimes(1);

    finishShutdown();
    await act(async () => {
      await reset;
      await replacement;
    });

    expect(createCliRuntimeBoot).toHaveBeenCalledTimes(2);
    expect(runMock).toHaveBeenCalledTimes(2);
  });

  it("binds an awaited exact-history checkpoint to the booted file world", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-checkpoint-"));
    const storagePath = path.join(dir, "world");
    initializeFileWorld(storagePath, "genesis-checkpoint");
    const world = createSessionWorldBinding({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    })!;
    const checkpoint = vi.fn(async () => undefined);
    const store = new ReactiveStore({ durable: "file", storagePath, principalId: "agent-a" });
    const hook = renderHook(() => useAgentLoop({ store, onHistoryCheckpoint: checkpoint }));

    await act(async () => {
      await hook.result.current.start("checkpoint me");
    });
    const callback = vi.mocked(createCliRuntimeBoot).mock.calls[0]?.[1]?.onHistoryCheckpoint;
    const exact: AgentLoopHistory = {
      messages: [{ role: "tool", toolCallId: "write", content: "exact-ref" }],
      pendingToolObservations: [],
    };
    await expect(callback?.(exact)).resolves.toBeUndefined();
    expect(checkpoint).toHaveBeenCalledWith(exact, world);

    await replaceFileWorld(storagePath, "replacement");
    await expect(callback?.(exact)).rejects.toThrow("generation changed");
    expect(checkpoint).toHaveBeenCalledTimes(1);

    hook.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects a hydrated transcript when the bundle is replaced before first boot", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-hydrated-generation-"));
    const storagePath = path.join(dir, "world");
    initializeFileWorld(storagePath, "genesis-old");
    const oldWorld = createSessionWorldBinding({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    });
    expect(oldWorld).not.toBeNull();

    const store = new ReactiveStore({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    });
    store.appendMessage({ role: "user", content: "old-generation secret", timestamp: 1 });
    const onSessionSeedInvalidated = vi.fn();
    const hook = renderHook(() =>
      useAgentLoop({
        store,
        sessionSeedWorld: oldWorld,
        onSessionSeedInvalidated,
      }),
    );

    await replaceFileWorld(storagePath, "genesis-replacement");
    let result: RunResult | undefined;
    await act(async () => {
      result = await hook.result.current.start("must not inherit the old transcript");
    });

    expect(result).toBeUndefined();
    expect(createCliRuntimeBoot).not.toHaveBeenCalled();
    expect(runMock).not.toHaveBeenCalled();
    expect(sessionConversationSeed(store.get().session.messages)).toEqual([]);
    expect(onSessionSeedInvalidated).toHaveBeenCalledTimes(1);
    expect(store.get().notice?.text).toContain("not bound to the current durable world generation");

    hook.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("closes a cached OS when its durable bundle generation is replaced", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-cached-generation-"));
    const storagePath = path.join(dir, "world");
    initializeFileWorld(storagePath, "genesis-old");
    const store = new ReactiveStore({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    });
    const hook = renderHook(() => useAgentLoop({ store }));

    await act(async () => {
      await hook.result.current.start("old-world task");
    });
    expect(createCliRuntimeBoot).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledTimes(1);

    await replaceFileWorld(storagePath, "genesis-replacement");
    await act(async () => {
      await hook.result.current.start("must fail closed");
    });

    expect(shutdownMock).toHaveBeenCalledTimes(1);
    expect(createCliRuntimeBoot).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(sessionConversationSeed(store.get().session.messages)).toEqual([]);
    expect(store.get().connected).toBe(false);

    hook.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("boots the replacement generation only after the old seed has been cleared", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-replacement-retry-"));
    const storagePath = path.join(dir, "world");
    initializeFileWorld(storagePath, "genesis-old");
    const store = new ReactiveStore({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    });
    const hook = renderHook(() => useAgentLoop({ store }));

    await act(async () => {
      await hook.result.current.start("old-generation secret");
    });
    await replaceFileWorld(storagePath, "genesis-replacement");
    await act(async () => {
      await hook.result.current.start("detect replacement");
    });
    await act(async () => {
      await hook.result.current.start("new-generation task");
    });

    expect(createCliRuntimeBoot).toHaveBeenCalledTimes(2);
    const replacementBoot = vi.mocked(createCliRuntimeBoot).mock.calls[1]?.[1];
    expect(replacementBoot?.initialMessages).toEqual([]);
    expect(JSON.stringify(replacementBoot?.initialMessages)).not.toContain("old-generation secret");
    expect(runMock).toHaveBeenCalledTimes(2);
    expect(store.get().connected).toBe(true);

    hook.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("keeps the verified old authority across the run-to-persist replacement window", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-post-run-replacement-"));
    const storagePath = path.join(dir, "world");
    initializeFileWorld(storagePath, "genesis-old");
    const store = new ReactiveStore({
      durable: "file",
      storagePath,
      principalId: "agent-a",
    });
    const sessionHook = renderHook(() => useSession(dir));
    await waitFor(() => expect(sessionHook.result.current.loaded).toBe(true));
    const loop = renderHook(() => useAgentLoop({ store }));

    // start() includes the post-run identity check and has now returned.
    await act(async () => {
      await loop.result.current.start("old-world result");
    });
    const expectedWorld = loop.result.current.sessionWorld();
    expect(expectedWorld?.genesisRef).toBe("genesis-old");

    // The replacement lands in the narrow window before App calls save().
    await replaceFileWorld(storagePath, "genesis-replacement");
    expect(
      createSessionWorldBinding({
        durable: "file",
        storagePath,
        principalId: "agent-a",
      })?.genesisRef,
    ).toBe("genesis-replacement");
    // The getter deliberately retains the run authority, so persistence fails
    // instead of relabelling old private history as replacement-world history.
    expect(loop.result.current.sessionWorld()).toEqual(expectedWorld);
    await expect(
      sessionHook.result.current.save(
        store.get().session,
        { messages: [], pendingToolObservations: [] },
        expectedWorld!,
      ),
    ).rejects.toThrow("current canonical file-world generation");

    loop.unmount();
    sessionHook.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it("filters display-only rows from a persisted conversation seed", () => {
    expect(
      sessionConversationSeed([
        { role: "user", content: "question", timestamp: 1 },
        { role: "system", content: "tool card", timestamp: 2 },
        { role: "error", content: "diagnostic", timestamp: 3 },
        { role: "assistant", content: "answer", timestamp: 4 },
      ]),
    ).toEqual([
      { role: "user", content: "question" },
      { role: "assistant", content: "answer" },
    ]);
  });

  it("useAgentLoop ignores concurrent start while running", async () => {
    let resolveRun!: (value: RunResult) => void;
    runMock.mockImplementationOnce(
      () =>
        new Promise<RunResult>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));

    let firstPromise!: Promise<RunResult | undefined>;
    let secondPromise!: Promise<RunResult | undefined>;
    await act(async () => {
      firstPromise = result.current.start("first");
      // Invoke again in the same event-loop turn, before React can publish the
      // `running` state from the first call.
      secondPromise = result.current.start("second");
    });

    const second = await secondPromise;
    expect(second).toBeUndefined();
    expect(createCliRuntimeBoot).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledTimes(1);

    resolveRun({
      ok: true,
      summary: "done",
      turns: 1,
      elapsedMs: 1,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    });
    await act(async () => {
      await firstPromise;
    });
  });

  it("does not refill a cleared session from a late aborted run", async () => {
    let resolveRun!: (value: RunResult) => void;
    runMock.mockImplementationOnce(
      () =>
        new Promise<RunResult>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));

    let pending!: Promise<RunResult | undefined>;
    await act(async () => {
      pending = result.current.start("old task");
    });
    await act(async () => {
      await result.current.stop();
      store.setSession({ messages: [], turnCount: 0 });
    });

    resolveRun({
      ok: false,
      summary: "late aborted summary",
      turns: 1,
      elapsedMs: 1,
      producedRefs: [],
      terminationReason: "aborted",
      operations: { committed: 0, rejected: 0 },
      toolCalls: { total: 0, succeeded: 0, failed: 0, unresolved: 0 },
    });
    await act(async () => {
      await pending;
    });

    expect(store.get().session.messages).toEqual([]);
    expect(store.get().connected).toBe(false);
  });

  it("useAgentLoop records errors", async () => {
    runMock.mockRejectedValueOnce(new Error("boom"));
    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await act(async () => {
      await result.current.start("fail");
    });
    expect(store.get().session.messages.some((m) => m.content.includes("boom"))).toBe(true);
    expect(store.get().notice?.level).toBe("error");

    runMock.mockRejectedValueOnce("string-failure");
    await act(async () => {
      await result.current.start("fail-string");
    });
    expect(store.get().session.messages.some((m) => m.content.includes("string-failure"))).toBe(
      true,
    );
  });

  it("useAgentLoop streams text deltas into one growing message", async () => {
    runMock.mockImplementationOnce(async (_instruction, opts) => {
      opts?.onEvent?.({ kind: "turn_start", turn: 1, elapsedMs: 0 });
      opts?.onEvent?.({ kind: "llm_start", turn: 1 });
      opts?.onEvent?.({ kind: "llm_delta", turn: 1, text: "Hello" });
      opts?.onEvent?.({ kind: "llm_delta", turn: 1, text: " world" });
      opts?.onEvent?.({
        kind: "llm_end",
        turn: 1,
        text: "Hello world",
        toolCalls: [],
        usage: { prompt: 10, completion: 5, total: 15 },
      });
      opts?.onEvent?.({ kind: "turn_end", turn: 1, elapsedMs: 5, lastAction: "text_response" });
      return {
        ok: true,
        summary: "Hello world",
        turns: 1,
        elapsedMs: 5,
        producedRefs: [],
      };
    });

    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await act(async () => {
      await result.current.start("greet");
    });

    const assistant = store.get().session.messages.filter((m) => m.role === "assistant");
    expect(assistant).toHaveLength(1);
    expect(assistant[0]?.content).toBe("Hello world");
    expect(assistant[0]?.streaming).toBe(false);
    expect(store.get().session.tokenUsage.total).toBe(15);
  });

  it("useAgentLoop projects tool lifecycle onto tool cards", async () => {
    runMock.mockImplementationOnce(async (_instruction, opts) => {
      opts?.onEvent?.({ kind: "turn_start", turn: 1, elapsedMs: 0 });
      opts?.onEvent?.({
        kind: "tool_start",
        turn: 1,
        toolCallId: "call_1",
        name: "write_content",
        arguments: { content: "report" },
      });
      opts?.onEvent?.({
        kind: "tool_end",
        turn: 1,
        toolCallId: "call_1",
        name: "write_content",
        ok: true,
        output: "Written. ref=sha256:abc",
      });
      return {
        ok: true,
        summary: "stored",
        turns: 1,
        elapsedMs: 3,
        producedRefs: [],
      };
    });

    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await act(async () => {
      await result.current.start("write it");
    });

    const card = store
      .get()
      .session.messages.flatMap((m) => m.toolCalls ?? [])
      .find((c) => c.id === "call_1");
    expect(card?.status).toBe("done");
    expect(card?.result?.output).toContain("sha256:abc");
  });

  it("useAgentLoop surfaces loop-reported errors", async () => {
    runMock.mockImplementationOnce(async (_instruction, opts) => {
      opts?.onEvent?.({
        kind: "error",
        turn: 2,
        phase: "llm",
        message: "rate limited",
        retryable: true,
      });
      return {
        ok: false,
        summary: "LLM error: rate limited",
        turns: 2,
        elapsedMs: 9,
        producedRefs: [],
        terminationReason: "error",
      };
    });

    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    await act(async () => {
      await result.current.start("boom");
    });

    expect(store.get().session.messages.some((m) => m.role === "error")).toBe(true);
    expect(store.get().notice?.text).toContain("rate limited");
  });

  it("useAgentLoop pauses on ASK_USER and resumes when the user answers", async () => {
    // The run emits an ask_user event, then awaits the onAskUser promise. The
    // hook surfaces the question as store.pendingAsk; resolving it with the
    // user's answer lets the loop inject the answer and finish the run.
    runMock.mockImplementationOnce(async (_instruction, opts) => {
      opts?.onEvent?.({ kind: "turn_start", turn: 1, elapsedMs: 0 });
      opts?.onEvent?.({
        kind: "ask_user",
        turn: 1,
        question: "Which color?",
        options: ["red", "blue"],
      });
      const answer = await opts?.onAskUser?.("Which color?", ["red", "blue"]);
      opts?.onEvent?.({ kind: "turn_end", turn: 2, elapsedMs: 4, lastAction: "ask_user" });
      return {
        ok: true,
        summary: `got ${answer ?? ""}`,
        turns: 2,
        elapsedMs: 4,
        producedRefs: [],
      };
    });

    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    let runPromise: Promise<unknown> | undefined;
    await act(async () => {
      runPromise = result.current.start("pick a color");
      // Let the ask_user event land and set store.pendingAsk before we answer.
      await Promise.resolve();
      await Promise.resolve();
    });

    // The loop is paused on the ask; the store holds the pending question.
    expect(store.get().mode).toBe("ask");
    const pending = store.get().pendingAsk;
    expect(pending?.question).toBe("Which color?");
    expect(pending?.options).toEqual(["red", "blue"]);
    expect(store.get().phase).toEqual({ kind: "asking", turn: 1 });

    await act(async () => {
      pending?.answer("blue");
      await runPromise;
    });

    // The answer is surfaced as a user message and the run completes.
    const userAnswers = store
      .get()
      .session.messages.filter((m) => m.role === "user")
      .map((m) => m.content);
    expect(userAnswers).toContain("blue");
    expect(store.get().pendingAsk).toBeNull();
    expect(store.get().mode).toBe("chat");
    expect(store.get().notice).toBeNull();
  });

  it("useAgentLoop aborting during an ASK_USER pause unblocks the loop", async () => {
    runMock.mockImplementationOnce(async (_instruction, opts) => {
      opts?.onEvent?.({ kind: "turn_start", turn: 1, elapsedMs: 0 });
      opts?.onEvent?.({ kind: "ask_user", turn: 1, question: "stuck?" });
      await opts?.onAskUser?.("stuck?");
      return { ok: true, summary: "aborted ask", turns: 1, elapsedMs: 1, producedRefs: [] };
    });

    const store = createMemoryStore();
    const { result } = renderHook(() => useAgentLoop({ store }));
    let runPromise: Promise<unknown> | undefined;
    await act(async () => {
      runPromise = result.current.start("get stuck");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store.get().pendingAsk).not.toBeNull();

    await act(async () => {
      result.current.abort();
      await runPromise;
    });

    // Aborting clears the ask and does not leave the loop hung on a dead ref.
    expect(store.get().pendingAsk).toBeNull();
    expect(store.get().mode).toBe("chat");
  });

  it("loads a legacy unbound session for inspection but refuses to restore it into a file world", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-"));
    const saved = { ...createStore().session, turnCount: 9 };
    const sessionDir = path.join(dir, ".cantilune");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(path.join(sessionDir, "session.json"), JSON.stringify(saved), "utf8");

    vi.resetModules();
    const { useSession: useSessionFresh } = await import("../../src/tui/hooks/useSession.js");
    const { result } = renderHook(() => useSessionFresh(dir));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const configuredStoragePath = path.join(dir, "configured-world");
    initializeFileWorld(configuredStoragePath);
    const configuredWorld = createSessionWorldBinding({
      durable: "file",
      storagePath: configuredStoragePath,
      principalId: "agent-a",
    });
    expect(result.current.world).toBeNull();
    expect(result.current.restoreFor(configuredWorld)).toBeNull();
    vi.restoreAllMocks();
  });

  it("useSession ignores load result after unmount", async () => {
    // Guard against a preceding test leaving fake timers installed: this case
    // waits on a real filesystem read and would otherwise never settle.
    vi.useRealTimers();

    // Point at a directory with a session file so the load path has real work
    // to do, then unmount before it settles. The hook's `cancelled` guard must
    // swallow the late result instead of writing into an unmounted component.
    const dir = await mkdtemp(path.join(tmpdir(), "cantilune-session-"));
    const sessionDir = path.join(dir, ".cantilune");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      path.join(sessionDir, "session.json"),
      JSON.stringify({ ...createStore().session, turnCount: 99 }),
      "utf8",
    );
    vi.resetModules();
    const { useSession: useSessionFresh } = await import("../../src/tui/hooks/useSession.js");
    const { result, unmount } = renderHook(() => useSessionFresh(dir));
    expect(result.current.loaded).toBe(false);

    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(result.current.loaded).toBe(false);

    vi.restoreAllMocks();
  });
});
