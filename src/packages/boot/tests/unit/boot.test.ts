import { describe, it, expect, vi } from "vitest";
import {
  bootMemoryOS,
  bootCantilune,
  createTerminationController,
  DEFAULT_THRESHOLDS,
  mergeToolExecutors,
  runAgentLoop,
  DEFAULT_TEMPLATES,
} from "../../src/index.js";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import { operationTypeId, type ActorRef } from "@cantilune/core";
import type {
  LlmAdapter,
  LlmChatResponse,
  ProgressEvent,
  AgentEvent,
  AgentLoopHistory,
} from "../../src/types.js";
import type { AvailableTemplate, SyscallRuntime, ToolExecutor } from "@cantilune/syscall";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

function createMockRuntime(): SyscallRuntime {
  const auditTail: unknown[] = [];
  const snap = {
    snapshotRef: "snap-1",
    epochId: "e1",
    participants: new Map<unknown, unknown>(),
    artifacts: new Map<unknown, unknown>(),
    links: new Map<unknown, unknown>(),
    sessions: new Map<unknown, unknown>(),
    capabilities: new Map<unknown, unknown>(),
    auditTail: auditTail as readonly unknown[],
  };
  return {
    getHead: () => snap,
    observe: (input) => {
      auditTail.push({
        sequenceNo: auditTail.length + 1,
        source: input.source,
        payloadRef: input.payloadRef,
        receivedAt: new Date().toISOString(),
      });
      return { ok: true };
    },
    changes: () => [],
    proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
  };
}

function doneAdapter(): LlmAdapter {
  return {
    async chat(): Promise<LlmChatResponse> {
      return {
        text: undefined,
        toolCalls: [{ id: "tc-1", name: "done", arguments: { summary: "All done!" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

function multiTurnAdapter(responses: LlmChatResponse[]): LlmAdapter {
  let turn = 0;
  return {
    async chat(): Promise<LlmChatResponse> {
      const r = responses[turn] ?? {
        text: "fallback",
        toolCalls: [],
        finishReason: "stop" as const,
      };
      turn++;
      return r;
    },
  };
}

describe("bootMemoryOS", () => {
  it("restores validated private history and awaits its terminal checkpoint", async () => {
    let request: Parameters<LlmAdapter["chat"]>[0] | undefined;
    const checkpoints: AgentLoopHistory[] = [];
    const checkpoint = vi.fn(async (history: AgentLoopHistory) => {
      checkpoints.push(history);
    });
    const os = bootMemoryOS(
      {
        async chat(value) {
          request = value;
          return doneAdapter().chat(value);
        },
      },
      {
        llm: mockLlmConfig,
        history: {
          messages: [{ role: "assistant", content: "trusted prior answer" }],
          pendingToolObservations: [],
        },
        onHistoryCheckpoint: checkpoint,
      },
    );

    expect((await os.run("continue")).ok).toBe(true);
    expect(request?.messages).toContainEqual({
      role: "assistant",
      content: "trusted prior answer",
    });
    expect(checkpoint).toHaveBeenCalledOnce();
    expect(checkpoints[0]?.messages).toContainEqual(
      expect.objectContaining({ role: "tool", toolCallId: "tc-1" }),
    );
  });

  it("throws when config.llm is missing", () => {
    expect(() => bootMemoryOS(doneAdapter(), {} as Parameters<typeof bootMemoryOS>[1])).toThrow(
      /config\.llm/,
    );
  });

  it("boots and runs a simple instruction to completion", async () => {
    const os = bootMemoryOS(doneAdapter(), {
      llm: mockLlmConfig,
      principalId: "test-agent",
    });
    const result = await os.run("Say hello");
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("All done!");
    expect(result.turns).toBe(1);
    expect(result.terminationReason).toBe("controller");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("shuts down without error", async () => {
    const os = bootMemoryOS(doneAdapter(), { llm: mockLlmConfig });
    await expect(os.shutdown()).resolves.toBeUndefined();
  });

  it("shutdown flushes contentStore and runtime when flush is available", async () => {
    const contentFlush = vi.fn().mockResolvedValue(undefined);
    const runtimeFlush = vi.fn().mockResolvedValue(undefined);
    const contentStore = Object.assign(createMemoryContentStore(), { flush: contentFlush });
    // `flush` is not part of SyscallRuntime; shutdown probes for it structurally.
    const runtime: SyscallRuntime & { flush: () => Promise<void> } = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
      flush: runtimeFlush,
    };
    const os = bootCantilune({
      runtime,
      contentStore,
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });
    await os.shutdown();
    expect(contentFlush).toHaveBeenCalledOnce();
    expect(runtimeFlush).toHaveBeenCalledOnce();
  });

  it("uses configurable principalId", async () => {
    let observedSource: unknown;
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [] as readonly unknown[],
      }),
      observe: (input) => {
        observedSource = input.source;
        return { ok: true };
      },
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const contentStore = createMemoryContentStore();
    const os = bootCantilune({
      runtime,
      contentStore,
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
        principalId: "my-custom-agent",
      },
    });
    await os.run("test");
    expect((observedSource as ActorRef).actorId).toBe("my-custom-agent");
  });
});

describe("bootCantilune", () => {
  it("poisons the OS after a private-history checkpoint failure", async () => {
    const runtime = createMockRuntime();
    const observe = vi.spyOn(runtime, "observe");
    const contentStore = createMemoryContentStore();
    const put = vi.spyOn(contentStore, "put");
    const chat = vi.fn<LlmAdapter["chat"]>(async () => ({
      text: undefined,
      toolCalls: [{ id: "write-poison", name: "write_content", arguments: { content: "x" } }],
      finishReason: "tool_calls",
    }));
    const checkpoint = vi.fn(async () => Promise.reject(new Error("disk offline")));
    const os = bootCantilune({
      runtime,
      contentStore,
      llmAdapter: { chat },
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: mockLlmConfig,
        onHistoryCheckpoint: checkpoint,
      },
    });

    const first = await os.run("write once");
    const counts = {
      put: put.mock.calls.length,
      observe: observe.mock.calls.length,
      chat: chat.mock.calls.length,
      checkpoint: checkpoint.mock.calls.length,
    };
    const history = os.privateHistory!();
    const second = await os.run("must not enter the world");

    expect(first.error?.message).toContain("checkpoint failed");
    expect(second).toMatchObject({
      ok: false,
      turns: 0,
      error: { phase: "configuration", retryable: false },
    });
    expect(second.summary).toContain("fail-closed");
    expect(put).toHaveBeenCalledTimes(counts.put);
    expect(observe).toHaveBeenCalledTimes(counts.observe);
    expect(chat).toHaveBeenCalledTimes(counts.chat);
    expect(checkpoint).toHaveBeenCalledTimes(counts.checkpoint);
    expect(os.privateHistory!()).toEqual(history);
  });

  it("rejects an unsafe per-run history override before entering the world", async () => {
    const runtime = createMockRuntime();
    const observe = vi.spyOn(runtime, "observe");
    const contentStore = createMemoryContentStore();
    const put = vi.spyOn(contentStore, "put");
    const chat = vi.fn(doneAdapter().chat);
    const foreign: AgentLoopHistory = { messages: [], pendingToolObservations: [] };
    const os = bootCantilune({
      runtime,
      contentStore,
      llmAdapter: { chat },
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: mockLlmConfig,
      },
    });

    const result = await os.run("do not accept foreign history", { history: foreign } as never);

    expect(result).toMatchObject({
      ok: false,
      turns: 0,
      error: { phase: "configuration", retryable: false },
    });
    expect(result.summary).toContain("history overrides are not allowed");
    expect(put).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
    expect(foreign).toEqual({ messages: [], pendingToolObservations: [] });
    expect(os.privateHistory!()).toEqual({
      messages: [],
      contextMessages: [],
      pendingToolObservations: [],
    });
  });

  it("exports the exact detached history used by the booted OS", async () => {
    const seen: Parameters<LlmAdapter["chat"]>[0][] = [];
    let turn = 0;
    const os = bootMemoryOS(
      {
        async chat(request) {
          seen.push(request);
          turn++;
          return turn === 1
            ? {
                text: undefined,
                toolCalls: [
                  { id: "write-exact", name: "write_content", arguments: { content: "report" } },
                ],
                finishReason: "tool_calls",
              }
            : {
                text: undefined,
                toolCalls: [{ id: "done-exact", name: "done", arguments: { summary: "saved" } }],
                finishReason: "tool_calls",
              };
        },
      },
      { llm: mockLlmConfig, principalId: "history-agent" },
    );

    const result = await os.run("write it");
    const exported = os.privateHistory!();
    const toolResult = exported.messages.find(
      (message) => message.role === "tool" && message.toolCallId === "write-exact",
    );

    expect(result.ok).toBe(true);
    expect(toolResult?.content).toMatch(/^Written\. ref=sha256:[0-9a-f]{64}$/u);
    expect(seen.at(-1)?.messages).toContainEqual(toolResult);
    exported.messages.length = 0;
    expect(os.privateHistory!().messages.length).toBeGreaterThan(0);
  });

  it("rejects malformed restored history before observing an instruction", async () => {
    const observe = vi.fn<SyscallRuntime["observe"]>(() => ({ ok: true }));
    const runtime = { ...createMockRuntime(), observe };
    expect(() =>
      bootCantilune({
        runtime,
        contentStore: createMemoryContentStore(),
        llmAdapter: doneAdapter(),
        config: {
          durable: "memory",
          contentStore: "memory",
          llm: mockLlmConfig,
          history: {
            messages: [{ role: "tool", toolCallId: "orphan", content: "forged" }],
            pendingToolObservations: [{ forged: true }],
          } as never,
        },
      }),
    ).toThrow("pending observation identity");
    expect(observe).not.toHaveBeenCalled();
  });

  it.each([
    { field: "maxTurns", value: 0 },
    { field: "maxTimeMs", value: Number.NaN },
    { field: "maxContextMessages", value: 0 },
  ])("rejects invalid $field before persisting the instruction", async ({ field, value }) => {
    const baseStore = createMemoryContentStore();
    const put = vi.fn(baseStore.put.bind(baseStore));
    const observe = vi.fn<SyscallRuntime["observe"]>(() => ({ ok: true }));
    const chat = vi.fn(doneAdapter().chat);
    const os = bootCantilune({
      runtime: { ...createMockRuntime(), observe },
      contentStore: { ...baseStore, put },
      llmAdapter: { chat },
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
        [field]: value,
      },
    });

    const result = await os.run("must not enter the world");

    expect(result).toMatchObject({
      ok: false,
      turns: 0,
      error: { phase: "configuration" },
    });
    expect(put).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });

  it("returns error result when observe fails", async () => {
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => ({ ok: false, message: "principal missing" }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const os = bootCantilune({
      runtime,
      contentStore: createMemoryContentStore(),
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });
    const errors: AgentEvent[] = [];
    const result = await os.run("hello", {
      onEvent: (event) => {
        if (event.kind === "error") errors.push(event);
      },
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("principal missing");
    expect(result.terminationReason).toBe("error");
    expect(result.turns).toBe(0);
    expect(result.toolCalls).toEqual({ total: 0, succeeded: 0, failed: 0, unresolved: 0 });
    expect(result.error).toEqual({
      phase: "perceive",
      message: "principal missing",
      retryable: false,
    });
    expect(errors).toEqual([
      {
        kind: "error",
        turn: 0,
        phase: "perceive",
        message: "principal missing",
        retryable: false,
      },
    ]);
  });

  it.each([
    {
      name: "content put throws",
      contentStore: {
        ...createMemoryContentStore(),
        put: vi.fn().mockRejectedValue(new Error("content offline")),
      },
      observe: () => ({ ok: true }),
      expected: "instruction content store error: content offline",
    },
    {
      name: "runtime observe throws",
      contentStore: createMemoryContentStore(),
      observe: () => {
        throw new Error("audit offline");
      },
      expected: "runtime observation error: audit offline",
    },
    {
      name: "runtime observe returns an invalid shape",
      contentStore: createMemoryContentStore(),
      observe: (() => undefined) as unknown as SyscallRuntime["observe"],
      expected: "runtime returned an invalid observation result",
    },
  ])("closes pre-loop failure when $name", async ({ contentStore, observe, expected }) => {
    const llm = { chat: vi.fn(doneAdapter().chat) } satisfies LlmAdapter;
    const runtime: SyscallRuntime = {
      ...createMockRuntime(),
      observe,
    };
    const os = bootCantilune({
      runtime,
      contentStore,
      llmAdapter: llm,
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });
    const errors: AgentEvent[] = [];

    const result = await os.run("hello", {
      onEvent: (event) => {
        if (event.kind === "error") errors.push(event);
      },
    });

    expect(result).toMatchObject({
      ok: false,
      turns: 0,
      terminationReason: "error",
      error: { phase: "perceive", message: expected },
    });
    expect(errors).toHaveLength(1);
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it("absorbs an asynchronously rejecting pre-loop observer", async () => {
    const runtime: SyscallRuntime = {
      ...createMockRuntime(),
      observe: () => ({ ok: false, message: "principal missing" }),
    };
    const os = bootCantilune({
      runtime,
      contentStore: createMemoryContentStore(),
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });

    const result = await os.run("hello", {
      onEvent: (() => Promise.reject(new Error("telemetry offline"))) as never,
    });
    await Promise.resolve();

    expect(result).toMatchObject({ ok: false, error: { phase: "perceive" } });
  });

  it("does not persist or observe an instruction when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const contentStore = createMemoryContentStore();
    const observe = vi.fn<SyscallRuntime["observe"]>();
    const os = bootCantilune({
      runtime: { ...createMockRuntime(), observe },
      contentStore,
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });

    const result = await os.run("must not enter the world", { signal: controller.signal });

    expect(result).toMatchObject({ ok: false, terminationReason: "aborted", turns: 0 });
    expect(await contentStore.count()).toBe(0);
    expect(observe).not.toHaveBeenCalled();
  });

  it("fails typed on an invalid instruction ContentRef before runtime observation", async () => {
    const observe = vi.fn<SyscallRuntime["observe"]>();
    const os = bootCantilune({
      runtime: { ...createMockRuntime(), observe },
      contentStore: {
        ...createMemoryContentStore(),
        put: vi.fn().mockResolvedValue("not-a-content-ref"),
      } as never,
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });

    const result = await os.run("unsafe dependency");

    expect(result).toMatchObject({
      ok: false,
      error: { phase: "perceive", message: expect.stringContaining("invalid ContentRef") },
    });
    expect(observe).not.toHaveBeenCalled();
  });

  it("fails typed when an observation result accessor throws", async () => {
    const os = bootCantilune({
      runtime: {
        ...createMockRuntime(),
        observe: (() => ({
          get ok(): boolean {
            throw new Error("hostile observation accessor");
          },
        })) as SyscallRuntime["observe"],
      },
      contentStore: createMemoryContentStore(),
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });

    const result = await os.run("unsafe result");

    expect(result).toMatchObject({
      ok: false,
      error: { phase: "perceive", message: expect.stringContaining("non-cloneable") },
    });
  });

  it("stores user instruction as proper ContentRef before observing", async () => {
    let observedPayloadRef: unknown;
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [] as readonly unknown[],
      }),
      observe: (input) => {
        observedPayloadRef = input.payloadRef;
        return { ok: true };
      },
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const contentStore = createMemoryContentStore();
    const os = bootCantilune({
      runtime,
      contentStore,
      llmAdapter: doneAdapter(),
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
      },
    });
    await os.run("Build feature X");
    expect(String(observedPayloadRef)).toMatch(/^sha256:/);
  });
});

describe("runAgentLoop", () => {
  it("handles multi-turn conversation with tool calls", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const artifactContentRef = await contentStore.put("Task body");
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("introduce_artifact"),
        description: "Introduce",
        requiredRoles: ["task", "from"],
        contentRefInputs: [{ name: "contentRef", required: true }],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "test", kind: "agent" },
      schemaProvider: provider,
    });

    const llm = multiTurnAdapter([
      {
        text: "I'll introduce an artifact.",
        toolCalls: [
          {
            id: "tc-1",
            name: "introduce_artifact",
            arguments: { task: "my-task", from: "test", contentRef: artifactContentRef },
          },
        ],
        finishReason: "tool_calls",
      },
      {
        text: undefined,
        toolCalls: [{ id: "tc-2", name: "done", arguments: { summary: "Created artifact." } }],
        finishReason: "tool_calls",
      },
    ]);

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "Create a task", detector, {
      maxTurns: 50,
      maxTimeMs: 60_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(true);
    expect(result.turns).toBe(2);
    expect(result.summary).toBe("Created artifact.");
    expect(result.terminationReason).toBe("controller");
  });

  it("handles write_content and read_content tool calls", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm = multiTurnAdapter([
      {
        text: undefined,
        toolCalls: [{ id: "w1", name: "write_content", arguments: { content: "hello world" } }],
        finishReason: "tool_calls",
      },
      {
        text: undefined,
        toolCalls: [{ id: "r1", name: "read_content", arguments: { ref: "" } }],
        finishReason: "tool_calls",
      },
      {
        text: undefined,
        toolCalls: [{ id: "d1", name: "done", arguments: { summary: "Read and wrote." } }],
        finishReason: "tool_calls",
      },
    ]);

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "Test content", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.producedRefs).toHaveLength(1);
    expect(result.toolCalls?.unresolved).toBe(1);
  });

  it("returns ok:false with terminationReason max_turns when limit exceeded", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return {
          text: "thinking...",
          toolCalls: [{ id: "x", name: "introduce_artifact", arguments: { task: "t", from: "t" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "loop", detector, {
      maxTurns: 3,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("max_turns");
    expect(result.turns).toBeLessThanOrEqual(3);
  });

  it("catches LLM errors gracefully (T1)", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        throw new Error("API key invalid");
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("API key invalid");
    expect(result.terminationReason).toBe("error");
  });

  it("handles act rejection from runtime (T3)", async () => {
    let proposeCount = 0;
    const runtime: SyscallRuntime = {
      getHead: () => ({
        snapshotRef: "s",
        epochId: "e",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [] as readonly unknown[],
      }),
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => {
        proposeCount++;
        if (proposeCount === 1) return { ok: false, message: "precondition_failed" };
        return { ok: true, newHeadRef: "snapshot-committed" };
      },
    };
    const contentStore = createMemoryContentStore();
    const artifactContentRef = await contentStore.put("Rejected task body");
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("introduce_artifact"),
        description: "Introduce",
        requiredRoles: ["task", "from"],
        contentRefInputs: [{ name: "contentRef", required: true }],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turnIdx = 0;
    const llm: LlmAdapter = {
      async chat(_req): Promise<LlmChatResponse> {
        turnIdx++;
        if (turnIdx === 1) {
          return {
            text: undefined,
            toolCalls: [
              {
                id: "a1",
                name: "introduce_artifact",
                arguments: { task: "x", from: "t", contentRef: artifactContentRef },
              },
            ],
            finishReason: "tool_calls",
          };
        }
        return {
          text: undefined,
          toolCalls: [{ id: "d1", name: "done", arguments: { summary: "Handled rejection." } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test rejection", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    // The loop recovers from the rejection and terminates cleanly, but the run
    // committed nothing, so it is not reported as a success.
    expect(result.turns).toBe(2);
    expect(result.summary).toContain("Handled rejection.");
    expect(result.operations).toEqual({ committed: 0, rejected: 1 });
    expect(result.ok).toBe(false);
  });

  it("supports AbortSignal for cancellation (S9)", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const controller = new AbortController();
    controller.abort();

    const llm: LlmAdapter = {
      async chat() {
        return { text: "x", toolCalls: [], finishReason: "stop" };
      },
    };
    const detector = createTerminationController({});
    const result = await runAgentLoop(
      syscall,
      llm,
      "test",
      detector,
      { maxTurns: 100, maxTimeMs: 600_000, maxContextMessages: 40 },
      { signal: controller.signal },
    );
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("aborted");
  });

  it("invokes progress callback after each turn (S9)", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const progressEvents: ProgressEvent[] = [];
    const readableRef = await contentStore.put("already available");
    const llm = multiTurnAdapter([
      {
        text: undefined,
        toolCalls: [
          { id: "w", name: "write_content", arguments: { content: "hi" } },
          { id: "r", name: "read_content", arguments: { ref: readableRef } },
        ],
        finishReason: "tool_calls",
      },
      {
        text: undefined,
        toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
        finishReason: "tool_calls",
      },
    ]);
    const detector = createTerminationController({});
    await runAgentLoop(
      syscall,
      llm,
      "test",
      detector,
      { maxTurns: 100, maxTimeMs: 600_000, maxContextMessages: 40 },
      { onProgress: (e) => progressEvents.push(e) },
    );
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(progressEvents[0]?.turn).toBe(1);
    expect(progressEvents[0]?.lastAction).toBe("read_content");
  });

  it("applies sliding window to avoid infinite context growth (S10/T4)", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("fork_branch"),
        description: "Fork",
        requiredRoles: ["from"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let lastMessageCount = 0;
    let turnIdx = 0;
    const llm: LlmAdapter = {
      async chat(req): Promise<LlmChatResponse> {
        lastMessageCount = req.messages.length;
        turnIdx++;
        if (turnIdx <= 10) {
          return {
            text: `turn ${turnIdx}`,
            toolCalls: [{ id: `t${turnIdx}`, name: "fork_branch", arguments: { from: "t" } }],
            finishReason: "tool_calls",
          };
        }
        return {
          text: undefined,
          toolCalls: [{ id: "done", name: "done", arguments: { summary: "done" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    await runAgentLoop(syscall, llm, "test window", detector, {
      maxTurns: 20,
      maxTimeMs: 600_000,
      maxContextMessages: 8,
    });
    // With maxContextMessages=8, compactMessages keeps system msgs + recent non-system msgs.
    // Each turn adds 2 messages (assistant+tool) + 1 dynamic context system msg appended at send time.
    // The compacted array itself stays within maxContextMessages + small overhead.
    expect(lastMessageCount).toBeLessThanOrEqual(20);
  });

  it("verdicts DONE when continuation has no value, not merely because finishReason is stop (S12/S16)", async () => {
    // The old invariant ("finishReason stop is never completion") was a negative
    // rule with no decision theory behind it. The controller replaces it with a
    // positive one: a turn terminates iff the math says so. Under the default
    // contract (one no_infinite_loop hard criterion) a single distinct plain-text
    // reply satisfies the criterion (q=1, ρ=1), so ΔC_t(a)=Σ w_i(1−q_i)rel·p_succ=0
    // for every candidate a, hence VOC_t(a)=−λ·cost−μ·risk<0 and
    // VOC*=max_a VOC_t(a)=−λ·cost_text−μ·risk_text=−0.1·0.5−0.2·0.1=−0.07≤ε=0.05.
    // The lexicographic gate (H=1, C=1, U=0, VOC*≤ε) therefore yields DONE after
    // one turn — the exact path that ends a "hello" after one reply.
    //
    // The loop-protection half of the old S12/S16 intent survives as a separate
    // property: when the reply IS a near-duplicate, no_infinite_loop / duplicate_reply
    // flip q to 0, the gate stays open but C<τ_C and the verdict is not DONE — that
    // is covered in the terminationStateMachine unit suite.
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        // A single distinct plain-text reply that satisfies the goal.
        return { text: "Here is the answer.", toolCalls: [], finishReason: "stop" };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "what is 2+2", detector, {
      maxTurns: 10,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    // finishReason "stop" did not auto-complete the run; the controller's math
    // did: completion met and no continuation action has positive value.
    expect(result.ok).toBe(true);
    expect(result.terminationReason).toBe("controller");
    expect(result.turns).toBe(1);
    expect(result.summary).toBe("Here is the answer.");
    // No tool was executed: termination was decided by the controller, not by a
    // done tool call.
    expect(result.toolCalls).toEqual({ total: 0, succeeded: 0, failed: 0, unresolved: 0 });
  });

  it("reports error on read_content with empty ref (S14)", async () => {
    const runtime = createMockRuntime();
    const contentStore = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm = multiTurnAdapter([
      {
        text: undefined,
        toolCalls: [{ id: "r", name: "read_content", arguments: { ref: "" } }],
        finishReason: "tool_calls",
      },
      {
        text: undefined,
        toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
        finishReason: "tool_calls",
      },
    ]);

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
  });
});

describe("termination controller defaults", () => {
  it("exposes fixed, centrally-configured thresholds", () => {
    expect(DEFAULT_THRESHOLDS.tauC).toBe(0.8);
    expect(DEFAULT_THRESHOLDS.tauU).toBe(0.2);
    expect(DEFAULT_THRESHOLDS.epsilon).toBe(0.05);
    expect(DEFAULT_THRESHOLDS.lambda).toBe(0.1);
    expect(DEFAULT_THRESHOLDS.mu).toBe(0.2);
    expect(DEFAULT_THRESHOLDS.hardGate).toBe(1);
  });

  it("compiles a default system contract when no LLM is provided", async () => {
    const controller = createTerminationController({});
    const contract = await controller.compileContract("any instruction");
    expect(contract.compiledBy).toBe("system");
    expect(contract.criteria).toHaveLength(1);
    expect(contract.criteria[0]?.verifierId).toBe("no_infinite_loop");
  });

  it("verdicts DONE for a single plain-text turn under the default contract", async () => {
    // "stop" with no tool calls is no longer special-cased; under the default
    // (no_infinite_loop) contract a single non-repeating reply satisfies the
    // hard gate, clears uncertainty, and offers no continuation value → DONE.
    // This is the path that ends a "hello" after one reply, without a chat mode.
    const controller = createTerminationController({});
    const contract = await controller.compileContract("hello");
    const verdict = await controller.evaluateTurn({
      contract,
      state: {
        environment: {
          worldSummary: "empty",
          headRef: undefined,
          epochId: undefined,
          participantCount: 0,
          artifactCount: 0,
          auditTailLength: 0,
        },
        artifacts: { artifactIds: [], contentRefs: [] },
        evidence: { items: [] },
        trace: {
          conversationTurns: 1,
          plainTextTurns: 1,
          toolCallTurns: 0,
          recentAssistantTexts: ["hi there"],
          committedOperations: 0,
          rejectedOperations: 0,
        },
        pendingReply: { text: "hi there", hasToolCalls: false },
      },
      candidateActions: [{ name: "reply", kind: "text" }],
      llmDoneSignal: false,
    });
    expect(verdict.kind).toBe("DONE");
  });
});

describe("mergeToolExecutors", () => {
  it("dispatches to correct executor by tool name (cached index)", async () => {
    const exec1: ToolExecutor = {
      async execute(name) {
        return { ok: true, output: `exec1:${name}` };
      },
      async listTools() {
        return [{ name: "tool_a", description: "A", parameters: {} }];
      },
    };
    const exec2: ToolExecutor = {
      async execute(name) {
        return { ok: true, output: `exec2:${name}` };
      },
      async listTools() {
        return [{ name: "tool_b", description: "B", parameters: {} }];
      },
    };
    const merged = mergeToolExecutors([exec1, exec2]);

    expect((await merged.execute("tool_a", {})).output).toBe("exec1:tool_a");
    expect((await merged.execute("tool_b", {})).output).toBe("exec2:tool_b");
  });

  it("returns error with available tools for unknown tool (S19)", async () => {
    const exec1: ToolExecutor = {
      async execute() {
        return { ok: true, output: "" };
      },
      async listTools() {
        return [{ name: "known_tool", description: "K", parameters: {} }];
      },
    };
    const merged = mergeToolExecutors([exec1]);
    const result = await merged.execute("unknown", {});
    expect(result.ok).toBe(false);
    expect(result.output).toContain("No executor found");
    expect(result.output).toContain("known_tool");
  });

  it("applies first-wins on duplicate tool names (S19)", async () => {
    const exec1: ToolExecutor = {
      async execute() {
        return { ok: true, output: "first" };
      },
      async listTools() {
        return [{ name: "dup", description: "D1", parameters: {} }];
      },
    };
    const exec2: ToolExecutor = {
      async execute() {
        return { ok: true, output: "second" };
      },
      async listTools() {
        return [{ name: "dup", description: "D2", parameters: {} }];
      },
    };
    const merged = mergeToolExecutors([exec1, exec2]);
    const result = await merged.execute("dup", {});
    expect(result.output).toBe("first");
  });

  it("lists all tools from all executors", async () => {
    const exec1: ToolExecutor = {
      async execute() {
        return { ok: true, output: "" };
      },
      async listTools() {
        return [{ name: "a", description: "A", parameters: {} }];
      },
    };
    const exec2: ToolExecutor = {
      async execute() {
        return { ok: true, output: "" };
      },
      async listTools() {
        return [{ name: "b", description: "B", parameters: {} }];
      },
    };
    const merged = mergeToolExecutors([exec1, exec2]);
    const tools = await merged.listTools();
    expect(tools.map((t) => t.name)).toEqual(["a", "b"]);
  });
});

describe("DEFAULT_TEMPLATES", () => {
  it("cannot be mutated through the public export", () => {
    expect(() =>
      (DEFAULT_TEMPLATES as AvailableTemplate[]).push({
        operationTypeId: operationTypeId("forged"),
        description: "forged",
        requiredRoles: [],
      }),
    ).toThrow();
    expect(() => (DEFAULT_TEMPLATES[0]!.requiredRoles as string[]).push("forged")).toThrow();
    const heartbeat = DEFAULT_TEMPLATES.find(
      (template) => (template.operationTypeId as string) === "emit_heartbeat",
    );
    expect(() => (heartbeat!.scalarInputs as unknown[]).push({})).toThrow();
    expect(() => Object.assign(heartbeat!.scalarInputs![0]!, { name: "forged" })).toThrow();
  });

  it("exports default templates for extension (E2)", () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const introduce = DEFAULT_TEMPLATES.find(
      (template) => (template.operationTypeId as string) === "introduce_artifact",
    );
    expect(introduce).toBeDefined();
    expect(introduce?.contentRefInputs).toEqual([
      expect.objectContaining({ name: "contentRef", required: true }),
    ]);
    const heartbeat = DEFAULT_TEMPLATES.find(
      (template) => (template.operationTypeId as string) === "emit_heartbeat",
    );
    expect(heartbeat?.scalarInputs).toEqual([
      expect.objectContaining({
        name: "turnCount",
        type: "nonNegativeInteger",
        required: true,
      }),
      expect.objectContaining({ name: "lastAction", type: "string", required: true }),
    ]);
  });
});
