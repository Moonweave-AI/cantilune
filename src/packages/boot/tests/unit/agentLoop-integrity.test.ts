import { describe, expect, it, vi } from "vitest";
import { contentRef } from "@cantilune/core";
import { createSyscall, createStaticSchemaProvider, toolArgumentsDigest } from "@cantilune/syscall";
import { createMemoryContentStore } from "@cantilune/content/memory";
import type { Syscall, SyscallRuntime, ToolExecutor } from "@cantilune/syscall";
import { createAgentLoopHistory, runAgentLoop } from "../../src/agentLoop.js";
import { createTerminationController } from "../../src/termination/index.js";
import type {
  AgentEvent,
  LlmAdapter,
  LlmChatResponse,
  LlmMessage,
  LlmToolDef,
  LlmToolCallResult,
} from "../../src/types.js";

const WRITTEN_REF = contentRef(
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

function baseSyscall(overrides: Partial<Syscall> = {}): Syscall {
  return {
    perceive: async () => ({
      worldSummary: "world",
      recentObservations: "observations",
      availableOperations: [],
      headRef: "snapshot-1",
    }),
    act: async () => ({ ok: true, message: "committed", newHeadRef: "snapshot-2" }),
    readContent: async (ref) => ({
      found: String(ref) === "sha256:good",
      text: String(ref) === "sha256:good" ? "recovered" : undefined,
      mimeType: String(ref) === "sha256:good" ? "text/plain" : undefined,
    }),
    writeContent: async () => WRITTEN_REF,
    useTool: async () => ({
      ok: true,
      output: "tool output",
      contentRef: undefined,
      observeWarning: undefined,
      observationRecovery: undefined,
    }),
    retryToolObservation: async (recovery) => ({
      ok: true,
      outputRef: recovery.outputRef,
      message: "Observation committed.",
      observeWarning: undefined,
    }),
    availableActions: async () => [],
    ...overrides,
  };
}

function scriptedAdapter(
  script: readonly (LlmChatResponse | ((request: readonly LlmMessage[]) => LlmChatResponse))[],
): LlmAdapter {
  let index = 0;
  return {
    async chat(request): Promise<LlmChatResponse> {
      const step = script[index];
      index++;
      if (step === undefined) throw new Error("LLM script exhausted");
      return typeof step === "function" ? step(request.messages) : step;
    },
  };
}

function toolResponse(call: LlmToolCallResult): LlmChatResponse {
  return { text: undefined, toolCalls: [call], finishReason: "tool_calls" };
}

function done(id = "done"): LlmChatResponse {
  return toolResponse({ id, name: "done", arguments: { summary: "claimed complete" } });
}

const config = { maxTurns: 100, maxTimeMs: 600_000, maxContextMessages: 40 } as const;

function observationRuntime(): { runtime: SyscallRuntime; observeCount: () => number } {
  let observations = 0;
  return {
    runtime: {
      getHead: () => ({
        snapshotRef: "snapshot-1",
        epochId: "epoch-1",
        participants: new Map(),
        artifacts: new Map(),
        links: new Map(),
        sessions: new Map(),
        capabilities: new Map(),
        auditTail: [],
      }),
      observe: () => {
        observations++;
        return observations === 1 ? { ok: false, message: "audit offline" } : { ok: true };
      },
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    },
    observeCount: () => observations,
  };
}

describe("agent loop trustworthy execution", () => {
  it("rejects done after an unresolved read failure and reports the total tally", async () => {
    const events: AgentEvent[] = [];
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "read", name: "read_content", arguments: { ref: "sha256:bad" } }),
        done(),
      ]),
      "read the requested content",
      createTerminationController({}),
      config,
      { onEvent: (event) => events.push(event) },
    );

    expect(result.ok).toBe(false);
    expect(result.operations).toEqual({ committed: 0, rejected: 0 });
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
    expect(result.error).toMatchObject({ phase: "tool", retryable: true });
    expect(events).toContainEqual(
      expect.objectContaining({ kind: "tool_end", name: "done", ok: false }),
    );
  });

  it("does not let a successful read of B conceal a failed read of A", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "bad-a", name: "read_content", arguments: { ref: "sha256:bad" } }),
        toolResponse({ id: "good-b", name: "read_content", arguments: { ref: "sha256:good" } }),
        done(),
      ]),
      "read both requested objects",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 1, failed: 2, unresolved: 1 });
  });

  it("clears a failed read when a successful corrected ref explicitly replaces it", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "bad", name: "read_content", arguments: { ref: "sha256:bad" } }),
        toolResponse({
          id: "good",
          name: "read_content",
          arguments: { ref: "sha256:good", cantiluneRecoveryOf: "bad" },
        }),
        done(),
      ]),
      "recover the content",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(true);
    expect(result.terminationReason).toBe("controller");
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 2, failed: 1, unresolved: 0 });
  });

  it("clears a failed read after an exact normalized retry succeeds", async () => {
    let attempts = 0;
    const result = await runAgentLoop(
      baseSyscall({
        readContent: async () => {
          attempts++;
          return attempts === 1
            ? { found: false, text: undefined, mimeType: undefined }
            : { found: true, text: "available now", mimeType: "text/plain" };
        },
      }),
      scriptedAdapter([
        toolResponse({ id: "read-1", name: "read_content", arguments: { ref: "sha256:same" } }),
        toolResponse({ id: "read-2", name: "read_content", arguments: { ref: "sha256:same" } }),
        done(),
      ]),
      "retry the temporarily unavailable object",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(true);
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 2, failed: 1, unresolved: 0 });
  });

  it("does not let a successful write of B conceal a rejected write of A", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "write-a", name: "write_content", arguments: { content: "" } }),
        toolResponse({ id: "write-b", name: "write_content", arguments: { content: "B" } }),
        done(),
      ]),
      "write both objects",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 1, failed: 2, unresolved: 1 });
  });

  it("allows a corrected write to explicitly replace its rejected call", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "write-a", name: "write_content", arguments: { content: "" } }),
        toolResponse({
          id: "write-fixed",
          name: "write_content",
          arguments: { content: "A", cantiluneRecoveryOf: "write-a" },
        }),
        done(),
      ]),
      "correct and write object A",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(true);
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 2, failed: 1, unresolved: 0 });
  });

  it("rejects done after an unresolved external-tool failure", async () => {
    const result = await runAgentLoop(
      baseSyscall({
        useTool: async () => ({
          ok: false,
          output: "network unavailable",
          contentRef: undefined,
          observeWarning: undefined,
          observationRecovery: undefined,
        }),
      }),
      scriptedAdapter([
        toolResponse({ id: "search", name: "tool:search", arguments: { query: "finance" } }),
        done(),
      ]),
      "research finance",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
  });

  it("does not let a successful external call B conceal failed call A", async () => {
    const result = await runAgentLoop(
      baseSyscall({
        useTool: async ({ args }) => ({
          ok: args["query"] === "B",
          output: args["query"] === "B" ? "B result" : "A unavailable",
          contentRef: args["query"] === "B" ? WRITTEN_REF : undefined,
          observeWarning: undefined,
          observationRecovery: undefined,
        }),
      }),
      scriptedAdapter([
        toolResponse({ id: "search-a", name: "tool:search", arguments: { query: "A" } }),
        toolResponse({ id: "search-b", name: "tool:search", arguments: { query: "B" } }),
        done(),
      ]),
      "research both A and B",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 1, failed: 2, unresolved: 1 });
  });

  it("refuses an exact external retry when no verified observation receipt exists", async () => {
    let attempts = 0;
    const result = await runAgentLoop(
      baseSyscall({
        useTool: async () => {
          attempts++;
          return {
            ok: attempts === 2,
            output: attempts === 2 ? "recovered result" : "temporary outage",
            contentRef: undefined,
            observeWarning: undefined,
            observationRecovery: undefined,
          };
        },
      }),
      scriptedAdapter([
        toolResponse({
          id: "search-1",
          name: "tool:search",
          arguments: { filters: { year: 2026, region: "CN" }, query: "finance" },
        }),
        toolResponse({
          id: "search-2",
          name: "tool:search",
          arguments: { query: "finance", filters: { region: "CN", year: 2026 } },
        }),
        done(),
      ]),
      "retry the failed search",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
    expect(attempts).toBe(1);
  });

  it("refuses to re-execute an ambiguous exact external observation retry", async () => {
    const history = createAgentLoopHistory();
    const argumentsDigest = toolArgumentsDigest({ query: "finance" });
    expect(argumentsDigest).toBeDefined();
    history.pendingToolObservations.push(
      {
        toolName: "search",
        originalToolCallId: "first-call",
        argumentsDigest: argumentsDigest!,
        outputRef: contentRef(
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
        receiptRef: contentRef(
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ),
      },
      {
        toolName: "search",
        originalToolCallId: "second-call",
        argumentsDigest: argumentsDigest!,
        outputRef: contentRef(
          "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        ),
        receiptRef: contentRef(
          "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        ),
      },
    );
    const useTool = vi.fn(baseSyscall().useTool);
    const retryToolObservation = vi.fn(baseSyscall().retryToolObservation);

    const result = await runAgentLoop(
      baseSyscall({ useTool, retryToolObservation }),
      scriptedAdapter([
        toolResponse({ id: "third-call", name: "tool:search", arguments: { query: "finance" } }),
        done(),
      ]),
      "resume the pending search observation",
      createTerminationController({}),
      config,
      { history },
    );

    expect(result.ok).toBe(false);
    expect(useTool).not.toHaveBeenCalled();
    expect(retryToolObservation).not.toHaveBeenCalled();
    expect(history.pendingToolObservations).toHaveLength(2);
  });

  it("refuses generic external recovery without executing the replacement call", async () => {
    const dispatchedArguments: Record<string, unknown>[] = [];
    const result = await runAgentLoop(
      baseSyscall({
        useTool: async ({ args }) => {
          dispatchedArguments.push(args);
          return {
            ok: args["query"] === "B",
            output: args["query"] === "B" ? "replacement result" : "A unavailable",
            contentRef: undefined,
            observeWarning: undefined,
            observationRecovery: undefined,
          };
        },
      }),
      scriptedAdapter([
        toolResponse({ id: "search-a", name: "tool:search", arguments: { query: "A" } }),
        toolResponse({
          id: "search-b",
          name: "tool:search",
          arguments: { query: "B", cantiluneRecoveryOf: "search-a" },
        }),
        done(),
      ]),
      "replace unavailable source A with source B",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
    expect(dispatchedArguments).toEqual([{ query: "A" }]);
  });

  it("retries a pending external observation across runs without re-executing", async () => {
    const { runtime, observeCount } = observationRuntime();
    const store = createMemoryContentStore();
    let executeCount = 0;
    const executor: ToolExecutor = {
      execute: async () => {
        executeCount++;
        return { ok: true, output: "side effect occurred once" };
      },
      listTools: async () => [],
    };
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "agent", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor: executor,
    });
    const history = createAgentLoopHistory();
    let pendingCheckpoint: typeof history | undefined;

    const first = await runAgentLoop(
      syscall,
      scriptedAdapter([
        toolResponse({ id: "external-1", name: "tool:tool:shell", arguments: { cmd: "once" } }),
        done("done-1"),
      ]),
      "perform one external action",
      createTerminationController({}),
      {
        ...config,
        onHistoryCheckpoint: (value) => {
          if (value.pendingToolObservations.length > 0) pendingCheckpoint = value;
        },
      },
      { history },
    );
    expect(first.ok).toBe(false);
    expect(history.pendingToolObservations).toHaveLength(1);
    expect(history.pendingToolObservations[0]?.toolName).toBe("tool:shell");
    expect(pendingCheckpoint?.pendingToolObservations).toEqual(history.pendingToolObservations);

    const second = await runAgentLoop(
      syscall,
      scriptedAdapter([
        toolResponse({ id: "external-2", name: "tool:tool:shell", arguments: { cmd: "once" } }),
        done("done-2"),
      ]),
      "finish the pending action",
      createTerminationController({}),
      config,
      { history },
    );

    expect(second.ok).toBe(true);
    expect(second.toolCalls).toEqual({ total: 2, succeeded: 2, failed: 0, unresolved: 0 });
    expect(history.pendingToolObservations).toHaveLength(0);
    expect(executeCount).toBe(1);
    expect(observeCount()).toBe(2);
  });

  it("checkpoints an exact tool group before the next LLM request", async () => {
    const history = createAgentLoopHistory();
    const checkpoints: (typeof history)[] = [];
    let requests = 0;
    const result = await runAgentLoop(
      baseSyscall({ writeContent: async () => WRITTEN_REF }),
      {
        async chat() {
          requests++;
          return requests === 1
            ? toolResponse({
                id: "write-checkpoint",
                name: "write_content",
                arguments: { content: "x" },
              })
            : done("after-checkpoint");
        },
      },
      "write and finish",
      createTerminationController({}),
      {
        ...config,
        history,
        onHistoryCheckpoint: (value) => {
          checkpoints.push(value);
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]?.messages).toContainEqual({
      role: "tool",
      toolCallId: "write-checkpoint",
      content: `Written. ref=${WRITTEN_REF}`,
    });
    expect(requests).toBe(2);
  });

  it("fails closed when private history checkpoint fails and does not request another turn", async () => {
    const history = createAgentLoopHistory();
    const chat = vi.fn<LlmAdapter["chat"]>(async () =>
      toolResponse({ id: "write-once", name: "write_content", arguments: { content: "x" } }),
    );
    const result = await runAgentLoop(
      baseSyscall({ writeContent: async () => WRITTEN_REF }),
      { chat },
      "must checkpoint",
      createTerminationController({}),
      {
        ...config,
        history,
        onHistoryCheckpoint: async () => Promise.reject(new Error("disk unavailable")),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      terminationReason: "error",
      error: { phase: "tool", message: expect.stringContaining("checkpoint failed") },
    });
    expect(chat).toHaveBeenCalledOnce();
    expect(history.messages).toContainEqual({
      role: "tool",
      toolCallId: "write-once",
      content: `Written. ref=${WRITTEN_REF}`,
    });
  });

  it("rejects a checkpoint callback that has no reusable private history", async () => {
    const chat = vi.fn(async () => done());
    const checkpoint = vi.fn();
    const result = await runAgentLoop(
      baseSyscall(),
      { chat },
      "misconfigured checkpoint",
      createTerminationController({}),
      { ...config, onHistoryCheckpoint: checkpoint },
    );

    expect(result).toMatchObject({
      ok: false,
      turns: 0,
      error: { phase: "configuration", message: expect.stringContaining("requires") },
    });
    expect(chat).not.toHaveBeenCalled();
    expect(checkpoint).not.toHaveBeenCalled();
  });

  it("checkpoints the terminal done assistant and tool result before returning", async () => {
    const history = createAgentLoopHistory();
    let terminalCheckpoint: typeof history | undefined;
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([done("terminal")]),
      "finish",
      createTerminationController({}),
      {
        ...config,
        history,
        onHistoryCheckpoint: (value) => {
          terminalCheckpoint = value;
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(terminalCheckpoint?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          toolCalls: [expect.objectContaining({ name: "done" })],
        }),
        expect.objectContaining({ role: "tool", content: "claimed complete" }),
      ]),
    );
  });

  it("re-observes a prefixed raw external tool in the same run without re-executing", async () => {
    const { runtime, observeCount } = observationRuntime();
    const store = createMemoryContentStore();
    let executeCount = 0;
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "agent", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor: {
        execute: async (toolName) => {
          executeCount++;
          expect(toolName).toBe("tool:shell");
          return { ok: true, output: "executed once" };
        },
        listTools: async () => [],
      },
    });

    const result = await runAgentLoop(
      syscall,
      scriptedAdapter([
        toolResponse({ id: "prefixed-1", name: "tool:tool:shell", arguments: { cmd: "once" } }),
        toolResponse({ id: "prefixed-2", name: "tool:tool:shell", arguments: { cmd: "once" } }),
        done("observed"),
      ]),
      "execute a prefixed raw tool once",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(true);
    expect(executeCount).toBe(1);
    expect(observeCount()).toBe(2);
  });

  it("restores serialized pending identity and uses explicit observation retry", async () => {
    const { runtime, observeCount } = observationRuntime();
    const store = createMemoryContentStore();
    let executeCount = 0;
    const executor: ToolExecutor = {
      execute: async () => {
        executeCount++;
        return { ok: true, output: "restart-safe output" };
      },
      listTools: async () => [],
    };
    const firstSyscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "agent", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
      toolExecutor: executor,
    });
    const firstHistory = createAgentLoopHistory();
    await runAgentLoop(
      firstSyscall,
      scriptedAdapter([
        toolResponse({ id: "restart-original", name: "tool:mcp", arguments: { value: 7 } }),
        done(),
      ]),
      "start external work",
      createTerminationController({}),
      config,
      { history: firstHistory },
    );
    const recovery = firstHistory.pendingToolObservations[0]!;
    const restored = JSON.parse(JSON.stringify(firstHistory)) as typeof firstHistory;
    const recreatedSyscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "agent", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
    });

    const result = await runAgentLoop(
      recreatedSyscall,
      scriptedAdapter([
        toolResponse({ id: "retry", name: "retry_tool_observation", arguments: { ...recovery } }),
        done("restart-done"),
      ]),
      "resume after caller-restored state",
      createTerminationController({}),
      config,
      { history: restored },
    );

    expect(result.ok).toBe(true);
    expect(restored.pendingToolObservations).toHaveLength(0);
    expect(executeCount).toBe(1);
    expect(observeCount()).toBe(2);
  });

  it("terminates on an invalid observation-retry protocol call before done can bypass it", async () => {
    const retryToolObservation = vi.fn<Syscall["retryToolObservation"]>();
    const result = await runAgentLoop(
      baseSyscall({ retryToolObservation }),
      scriptedAdapter([
        toolResponse({
          id: "invalid-retry",
          name: "retry_tool_observation",
          arguments: {},
        }),
        done("must-not-run"),
      ]),
      "do not accept an unverified recovery",
      createTerminationController({}),
      config,
    );

    expect(result).toMatchObject({
      ok: false,
      terminationReason: "error",
      error: { phase: "tool", retryable: false, toolCallId: "invalid-retry" },
      toolCalls: { total: 1, succeeded: 0, failed: 1, unresolved: 0 },
    });
    expect(retryToolObservation).not.toHaveBeenCalled();
  });

  it("does not dispatch tools from a late response after caller abort", async () => {
    const controller = new AbortController();
    let release!: (response: LlmChatResponse) => void;
    const delayed = new Promise<LlmChatResponse>((resolve) => {
      release = resolve;
    });
    const useTool = vi.fn<Syscall["useTool"]>();
    const act = vi.fn<Syscall["act"]>();
    const run = runAgentLoop(
      baseSyscall({ useTool, act }),
      { chat: async () => delayed },
      "do not mutate after abort",
      createTerminationController({}),
      config,
      { signal: controller.signal },
    );

    await Promise.resolve();
    controller.abort();
    release(toolResponse({ id: "late", name: "tool:shell", arguments: { cmd: "mutate" } }));
    const result = await run;

    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("aborted");
    expect(useTool).not.toHaveBeenCalled();
    expect(act).not.toHaveBeenCalled();
  });

  it("does not call the LLM when perception aborts the run", async () => {
    const controller = new AbortController();
    const chat = vi.fn(async () => done());
    const result = await runAgentLoop(
      baseSyscall({
        perceive: async () => {
          controller.abort();
          return {
            worldSummary: "world",
            recentObservations: "observations",
            availableOperations: [],
            headRef: "snapshot-1",
          };
        },
      }),
      { chat },
      "abort during perception",
      createTerminationController({}),
      config,
      { signal: controller.signal },
    );

    expect(result).toMatchObject({ ok: false, terminationReason: "aborted" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("does not call the LLM after turn preparation exhausts the time budget", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const chat = vi.fn(async () => done());
    try {
      const result = await runAgentLoop(
        baseSyscall({
          availableActions: async () => {
            now = 11;
            return [];
          },
        }),
        { chat },
        "do not start a late request",
        createTerminationController({}),
        { ...config, maxTimeMs: 10 },
      );

      expect(result).toMatchObject({ ok: false, terminationReason: "max_time" });
      expect(chat).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("does not start another tool after an earlier call exhausts the time budget", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const dispatched: string[] = [];
    try {
      const history = createAgentLoopHistory();
      const checkpoints: (typeof history)[] = [];
      const result = await runAgentLoop(
        baseSyscall({
          useTool: async ({ toolName }) => {
            dispatched.push(toolName);
            now = 11;
            return {
              ok: true,
              output: `${toolName} complete`,
              contentRef: WRITTEN_REF,
              observeWarning: undefined,
              observationRecovery: undefined,
            };
          },
        }),
        scriptedAdapter([
          {
            text: undefined,
            toolCalls: [
              { id: "slow", name: "tool:slow", arguments: {} },
              { id: "must-not-run", name: "tool:destructive", arguments: {} },
              { id: "also-must-not-run", name: "done", arguments: { summary: "unsafe" } },
            ],
            finishReason: "tool_calls",
          },
        ]),
        "respect the tool-group budget",
        createTerminationController({}),
        {
          ...config,
          maxTimeMs: 10,
          history,
          onHistoryCheckpoint: (value) => {
            checkpoints.push(value);
          },
        },
      );

      expect(result).toMatchObject({ ok: false, terminationReason: "max_time" });
      expect(dispatched).toEqual(["slow"]);
      expect(result.toolCalls).toEqual({ total: 3, succeeded: 1, failed: 2, unresolved: 0 });
      expect(history.messages.slice(-4)).toEqual([
        expect.objectContaining({
          role: "assistant",
          toolCalls: [
            expect.objectContaining({ id: "slow" }),
            expect.objectContaining({ id: "must-not-run" }),
            expect.objectContaining({ id: "also-must-not-run" }),
          ],
        }),
        expect.objectContaining({ role: "tool", toolCallId: "slow" }),
        expect.objectContaining({
          role: "tool",
          toolCallId: "must-not-run",
          content: expect.stringContaining("[SKIPPED: NOT EXECUTED]"),
        }),
        expect.objectContaining({
          role: "tool",
          toolCallId: "also-must-not-run",
          content: expect.stringContaining("[SKIPPED: NOT EXECUTED]"),
        }),
      ]);
      expect(checkpoints).toHaveLength(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("bounds a never-settling adapter with a local timeout", async () => {
    vi.useFakeTimers();
    try {
      const useTool = vi.fn<Syscall["useTool"]>();
      const run = runAgentLoop(
        baseSyscall({ useTool }),
        { chat: async () => new Promise<LlmChatResponse>(() => undefined) },
        "bound the adapter",
        createTerminationController({}),
        { ...config, perTurnTimeoutMs: 50 },
      );

      await vi.advanceTimersByTimeAsync(51);
      const result = await run;

      expect(result.ok).toBe(false);
      expect(result.error).toMatchObject({ phase: "llm", retryable: true });
      expect(result.summary).toContain("timed out");
      expect(useTool).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminates a stream immediately at done without consuming later chunks", async () => {
    let afterDoneConsumed = false;
    const llm: LlmAdapter = {
      chat: async () => done(),
      async *stream() {
        yield { kind: "text_delta", text: "partial" } as const;
        yield { kind: "done", response: done("stream done") } as const;
        afterDoneConsumed = true;
        await new Promise<void>(() => undefined);
      },
    };
    const result = await runAgentLoop(
      baseSyscall(),
      llm,
      "finish stream",
      createTerminationController({}),
      config,
      { onEvent: () => undefined },
    );
    expect(result.ok).toBe(true);
    expect(afterDoneConsumed).toBe(false);
  });

  it.each([
    { kind: "text_delta", text: 7 },
    { kind: "tool_call_delta", index: -1 },
    { kind: "unknown" },
  ])("fails typed when a stream yields malformed chunk %#", async (chunk) => {
    const llm = {
      chat: async () => done(),
      async *stream() {
        yield chunk;
      },
    } as unknown as LlmAdapter;
    const result = await runAgentLoop(
      baseSyscall(),
      llm,
      "reject malformed stream",
      createTerminationController({}),
      config,
      { onEvent: () => undefined },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe("llm");
  });

  it("materializes each stream chunk before validation and emission", async () => {
    let textReads = 0;
    const llm = {
      chat: async () => done(),
      async *stream() {
        yield {
          kind: "text_delta",
          get text() {
            textReads++;
            return textReads === 1 ? "stable" : "mutated";
          },
        };
        yield { kind: "done", response: done() };
      },
    } as unknown as LlmAdapter;
    const deltas: string[] = [];

    const result = await runAgentLoop(
      baseSyscall(),
      llm,
      "stream safely",
      createTerminationController({}),
      config,
      {
        onEvent: (event) => {
          if (event.kind === "llm_delta") deltas.push(event.text);
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(textReads).toBe(1);
    expect(deltas).toEqual(["stable"]);
  });

  it("does not accept an invalid or cross-tool recovery link", async () => {
    const toolOutputs: string[] = [];
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "read-a", name: "read_content", arguments: { ref: "sha256:bad" } }),
        toolResponse({
          id: "write-b",
          name: "write_content",
          arguments: { content: "B", cantiluneRecoveryOf: "read-a" },
        }),
        done(),
      ]),
      "do not cross-link unrelated operations",
      createTerminationController({}),
      config,
      {
        onEvent: (event) => {
          if (event.kind === "tool_end") toolOutputs.push(event.output);
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 1, failed: 2, unresolved: 1 });
    expect(toolOutputs).toContainEqual(expect.stringContaining("no failure was cleared"));
  });

  it("does not let a successful coordination target clear a rejected target", async () => {
    const dispatched: { operation: string; args: Record<string, string> }[] = [];
    const result = await runAgentLoop(
      baseSyscall({
        act: async (call) => {
          dispatched.push(call);
          return {
            ok: call.args["task"] === "B",
            message: call.args["task"] === "B" ? "committed B" : "rejected A",
            newHeadRef: call.args["task"] === "B" ? "snapshot-B" : undefined,
          };
        },
      }),
      scriptedAdapter([
        toolResponse({
          id: "introduce-a",
          name: "introduce_artifact",
          arguments: { task: "A", from: "agent" },
        }),
        toolResponse({
          id: "introduce-b",
          name: "introduce_artifact",
          arguments: { task: "B", from: "agent", cantiluneRecoveryOf: "introduce-a" },
        }),
        done(),
      ]),
      "introduce both targets",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.operations).toEqual({ committed: 1, rejected: 1 });
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 1, failed: 2, unresolved: 1 });
    expect(dispatched).toEqual([
      { operation: "introduce_artifact", args: { task: "A", from: "agent" } },
      { operation: "introduce_artifact", args: { task: "B", from: "agent" } },
    ]);
  });

  it("advertises explicit recovery metadata only on content and external tools", async () => {
    let advertisedTools: readonly LlmToolDef[] = [];
    const result = await runAgentLoop(
      baseSyscall({
        availableActions: async () => [
          {
            name: "fork_branch",
            description: "fork",
            parameters: { type: "object", properties: { from: { type: "string" } } },
          },
          {
            name: "tool:search",
            description: "search",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
              additionalProperties: false,
            },
          },
        ],
      }),
      {
        async chat(request): Promise<LlmChatResponse> {
          advertisedTools = request.tools;
          return done();
        },
      },
      "inspect recovery schemas",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(true);
    for (const name of ["read_content", "write_content"]) {
      expect(toolProperties(advertisedTools, name)).toHaveProperty("cantiluneRecoveryOf");
    }
    expect(toolProperties(advertisedTools, "tool:search")).not.toHaveProperty(
      "cantiluneRecoveryOf",
    );
    expect(toolProperties(advertisedTools, "retry_tool_observation")).toMatchObject({
      originalToolCallId: expect.any(Object),
      outputRef: expect.any(Object),
      receiptRef: expect.any(Object),
    });
    expect(toolProperties(advertisedTools, "fork_branch")).not.toHaveProperty(
      "cantiluneRecoveryOf",
    );
    expect(toolProperties(advertisedTools, "done")).not.toHaveProperty("cantiluneRecoveryOf");
  });

  it("does not let done bypass a failing sibling call in the same response", async () => {
    const events: AgentEvent[] = [];
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        {
          text: undefined,
          toolCalls: [
            { id: "early-done", name: "done", arguments: { summary: "too early" } },
            { id: "bad-read", name: "read_content", arguments: { ref: "sha256:bad" } },
          ],
          finishReason: "tool_calls",
        },
      ]),
      "read before completing",
      createTerminationController({}),
      config,
      { onEvent: (event) => events.push(event) },
    );

    expect(result.ok).toBe(false);
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
    expect(
      events.filter((event) => event.kind === "tool_start").map((event) => event.name),
    ).toEqual(["read_content", "done"]);
    expect(events).toContainEqual(
      expect.objectContaining({ kind: "tool_end", name: "done", ok: false }),
    );
  });

  it("executes a valid done call on the last allowed LLM turn", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({
          id: "done-on-turn-one",
          name: "done",
          arguments: { summary: "finished on turn one" },
        }),
      ]),
      "finish immediately",
      createTerminationController({}),
      { ...config, maxTurns: 1 },
    );

    expect(result.ok).toBe(true);
    expect(result.terminationReason).toBe("controller");
    expect(result.summary).toBe("finished on turn one");
  });

  it("executes substantive calls before done on the last allowed turn", async () => {
    const writes: string[] = [];
    const result = await runAgentLoop(
      baseSyscall({
        writeContent: async (content) => {
          writes.push(content);
          return WRITTEN_REF;
        },
      }),
      scriptedAdapter([
        {
          text: undefined,
          toolCalls: [
            { id: "write-last", name: "write_content", arguments: { content: "evidence" } },
            { id: "done-last", name: "done", arguments: { summary: "written" } },
          ],
          finishReason: "tool_calls",
        },
      ]),
      "write then finish",
      createTerminationController({}),
      { ...config, maxTurns: 1 },
    );

    expect(result.ok).toBe(true);
    expect(writes).toEqual(["evidence"]);
    expect(result.toolCalls?.total).toBe(2);
  });

  it.each([{}, { summary: "" }, { summary: 7 }])(
    "rejects done with invalid arguments %j",
    async (arguments_) => {
      const result = await runAgentLoop(
        baseSyscall(),
        scriptedAdapter([toolResponse({ id: "bad-done", name: "done", arguments: arguments_ })]),
        "require a summary",
        createTerminationController({}),
        { ...config, maxTurns: 1 },
      );

      expect(result.ok).toBe(false);
      expect(result.terminationReason).toBe("max_turns");
      expect(result.toolCalls).toEqual({ total: 1, succeeded: 0, failed: 1, unresolved: 1 });
    },
  );

  it("allows a corrected done declaration to resolve only its prior summary failure", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "bad-done", name: "done", arguments: {} }),
        toolResponse({ id: "good-done", name: "done", arguments: { summary: "corrected" } }),
      ]),
      "correct completion metadata",
      createTerminationController({}),
      config,
    );

    expect(result).toMatchObject({
      ok: true,
      summary: "corrected",
      toolCalls: { total: 2, succeeded: 1, failed: 1, unresolved: 0 },
    });
  });

  it("fails immediately on duplicate done declarations in one response", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        {
          text: undefined,
          toolCalls: [
            { id: "done-a", name: "done", arguments: { summary: "A" } },
            { id: "done-b", name: "done", arguments: { summary: "B" } },
          ],
          finishReason: "tool_calls",
        },
      ]),
      "reject ambiguous completion",
      createTerminationController({}),
      config,
    );

    expect(result).toMatchObject({
      ok: false,
      terminationReason: "error",
      error: { phase: "tool", toolCallId: "done-a" },
    });
  });

  it.each([
    { messages: [null], pendingToolObservations: [] },
    {
      messages: [{ role: "bogus", content: "unsafe" }],
      pendingToolObservations: [],
    },
    {
      messages: [],
      pendingToolObservations: [{ toolName: 7 }],
    },
    {
      messages: [{ role: "user", content: () => "not cloneable" }],
      pendingToolObservations: [],
    },
  ])("fails typed before execution for malformed restored history %#", async (history) => {
    const perceive = vi.fn<Syscall["perceive"]>();
    const chat = vi.fn<LlmAdapter["chat"]>();

    const result = await runAgentLoop(
      baseSyscall({ perceive }),
      { chat },
      "do not execute",
      createTerminationController({}),
      config,
      { history: history as never },
    );

    expect(result).toMatchObject({
      ok: false,
      terminationReason: "error",
      error: { phase: "configuration" },
    });
    expect(perceive).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });

  it.each([
    [{ maxTurns: 0 }, "maxTurns"],
    [{ maxTimeMs: Number.NaN }, "maxTimeMs"],
    [{ maxContextMessages: 0 }, "maxContextMessages"],
    [{ perTurnTimeoutMs: Number.POSITIVE_INFINITY }, "perTurnTimeoutMs"],
  ] as const)("fails typed before execution for invalid limit %j", async (patch, field) => {
    const perceive = vi.fn<Syscall["perceive"]>();
    const history = createAgentLoopHistory([{ role: "assistant", content: "unchanged" }]);
    const before = JSON.parse(JSON.stringify(history)) as typeof history;
    const result = await runAgentLoop(
      baseSyscall({ perceive }),
      { chat: vi.fn<LlmAdapter["chat"]>() },
      "do not execute",
      createTerminationController({}),
      { ...config, ...patch, history },
    );

    expect(result).toMatchObject({
      ok: false,
      terminationReason: "error",
      error: { phase: "configuration", message: expect.stringContaining(field) },
    });
    expect(perceive).not.toHaveBeenCalled();
    expect(history).toEqual(before);
  });

  it("rejects a frozen history target before perception or LLM execution", async () => {
    const perceive = vi.fn<Syscall["perceive"]>();
    const chat = vi.fn<LlmAdapter["chat"]>();
    const history = Object.freeze({
      messages: Object.freeze<LlmMessage[]>([]),
      pendingToolObservations: Object.freeze([]),
    });
    const checkpoint = vi.fn();

    const result = await runAgentLoop(
      baseSyscall({ perceive }),
      { chat },
      "must not mutate",
      createTerminationController({}),
      { ...config, history: history as never, onHistoryCheckpoint: checkpoint },
    );

    expect(result).toMatchObject({ ok: false, error: { phase: "configuration" } });
    expect(perceive).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
    expect(checkpoint).not.toHaveBeenCalled();
  });

  it("absorbs asynchronously rejecting observers without changing completion", async () => {
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([done()]),
      "finish",
      createTerminationController({}),
      config,
      {
        onEvent: (() => Promise.reject(new Error("event sink offline"))) as never,
        onProgress: (() => Promise.reject(new Error("progress sink offline"))) as never,
      },
    );
    await Promise.resolve();

    expect(result.ok).toBe(true);
  });

  it("returns a typed perceive error instead of rejecting the run promise", async () => {
    const chat = vi.fn<LlmAdapter["chat"]>();
    const phases: string[] = [];
    const result = await runAgentLoop(
      baseSyscall({ perceive: async () => Promise.reject(new Error("snapshot unavailable")) }),
      { chat },
      "inspect the world",
      createTerminationController({}),
      config,
      {
        onEvent: (event) => {
          if (event.kind === "error") phases.push(event.phase);
        },
      },
    );

    expect(chat).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      phase: "perceive",
      message: "snapshot unavailable",
      retryable: false,
    });
    expect(phases).toEqual(["perceive"]);
  });

  it("isolates event callbacks from tool-call mutation and callback failures", async () => {
    const writes: string[] = [];
    const result = await runAgentLoop(
      baseSyscall({
        writeContent: async (content) => {
          writes.push(content);
          return WRITTEN_REF;
        },
      }),
      scriptedAdapter([
        toolResponse({
          id: "write-isolated",
          name: "write_content",
          arguments: { content: "original" },
        }),
        done("complete"),
      ]),
      "protect the execution input",
      createTerminationController({}),
      config,
      {
        onEvent: (event) => {
          if (event.kind === "llm_end" && event.toolCalls[0] !== undefined) {
            (event.toolCalls[0].arguments as { content?: string }).content = "mutated";
          }
          if (event.kind === "tool_end") throw new Error("renderer failed");
        },
        onProgress: () => {
          throw new Error("progress renderer failed");
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(writes).toEqual(["original"]);
  });

  it.each([
    { label: "non-array toolCalls", response: { text: "x", toolCalls: {}, finishReason: "stop" } },
    {
      label: "malformed tool call",
      response: {
        text: undefined,
        toolCalls: [{ id: "", name: "done", arguments: { summary: "forged" } }],
        finishReason: "tool_calls",
      },
    },
    {
      label: "duplicate tool-call identity",
      response: {
        text: undefined,
        toolCalls: [
          { id: "same", name: "write_content", arguments: { content: "x" } },
          { id: "same", name: "done", arguments: { summary: "forged" } },
        ],
        finishReason: "tool_calls",
      },
    },
    {
      label: "tool calls with a non-tool finish reason",
      response: {
        text: undefined,
        toolCalls: [{ id: "call", name: "done", arguments: { summary: "forged" } }],
        finishReason: "stop",
      },
    },
    {
      label: "tool finish reason without tool calls",
      response: { text: undefined, toolCalls: [], finishReason: "tool_calls" },
    },
  ])("returns a typed LLM error for $label", async ({ response }) => {
    const llm = {
      chat: async () => response,
    } as unknown as LlmAdapter;

    const result = await runAgentLoop(
      baseSyscall(),
      llm,
      "reject malformed adapter output",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
    expect(result.error?.phase).toBe("llm");
    expect(result.toolCalls?.total).toBe(0);
  });

  it.each([
    {
      label: "coordination result",
      syscall: baseSyscall({
        act: async () => ({ ok: "false", message: "forged", newHeadRef: undefined }) as never,
      }),
      response: toolResponse({ id: "act", name: "fork_branch", arguments: { from: "t" } }),
    },
    {
      label: "external tool result",
      syscall: baseSyscall({
        useTool: async () => ({ ok: "false", output: "forged" }) as never,
      }),
      response: toolResponse({ id: "tool", name: "tool:mcp", arguments: {} }),
    },
    {
      label: "content write ref",
      syscall: baseSyscall({ writeContent: async () => "sha256:not-a-digest" as never }),
      response: toolResponse({
        id: "write",
        name: "write_content",
        arguments: { content: "x" },
      }),
    },
  ])("fails closed on an invalid syscall $label", async ({ syscall, response }) => {
    const result = await runAgentLoop(
      syscall,
      scriptedAdapter([response, done("must not run")]),
      "reject malformed syscall output",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
    expect(result.error?.phase).toBe("tool");
    expect(result.toolCalls).toMatchObject({ total: 1, succeeded: 0, failed: 1, unresolved: 1 });
  });

  it("rejects an external recovery identity that does not match the dispatched call", async () => {
    const result = await runAgentLoop(
      baseSyscall({
        useTool: async () => ({
          ok: false,
          output: "stored output",
          contentRef: WRITTEN_REF,
          observeWarning: "audit unavailable",
          observationRecovery: {
            toolName: "different-tool",
            originalToolCallId: "different-call",
            argumentsDigest:
              "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            outputRef: WRITTEN_REF,
            receiptRef: contentRef(
              "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            ),
          },
        }),
      }),
      scriptedAdapter([toolResponse({ id: "real-call", name: "tool:mcp", arguments: {} })]),
      "reject mismatched recovery",
      createTerminationController({}),
      config,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe("tool");
    expect(result.summary).toContain("invalid observation recovery identity");
  });

  it("rejects an observation retry that confirms a different output ref", async () => {
    const history = createAgentLoopHistory();
    history.pendingToolObservations.push({
      toolName: "mcp",
      originalToolCallId: "original",
      argumentsDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      outputRef: WRITTEN_REF,
      receiptRef: contentRef(
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    });
    const result = await runAgentLoop(
      baseSyscall({
        retryToolObservation: async () => ({
          ok: true,
          outputRef: contentRef(
            "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          ),
          message: "forged retry",
          observeWarning: undefined,
        }),
      }),
      scriptedAdapter([toolResponse({ id: "retry", name: "tool:mcp", arguments: {} }), done()]),
      "retry exact pending observation",
      createTerminationController({}),
      config,
      { history },
    );

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe("tool");
    expect(history.pendingToolObservations).toHaveLength(1);
  });

  it.each([
    {
      label: "successful retry carrying a rejection warning",
      result: {
        ok: true,
        outputRef: WRITTEN_REF,
        message: "forged success",
        observeWarning: "actually rejected",
      },
    },
    {
      label: "failed retry carrying a successful output ref",
      result: {
        ok: false,
        outputRef: WRITTEN_REF,
        message: "forged failure",
        observeWarning: "audit unavailable",
      },
    },
  ])("rejects a contradictory $label", async ({ result: retryResult }) => {
    const history = createAgentLoopHistory();
    history.pendingToolObservations.push({
      toolName: "mcp",
      originalToolCallId: "original",
      argumentsDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      outputRef: WRITTEN_REF,
      receiptRef: contentRef(
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    });

    const result = await runAgentLoop(
      baseSyscall({ retryToolObservation: async () => retryResult as never }),
      scriptedAdapter([toolResponse({ id: "retry", name: "tool:mcp", arguments: {} }), done()]),
      "reject contradictory retry result",
      createTerminationController({}),
      config,
      { history },
    );

    expect(result.ok).toBe(false);
    expect(result.error?.phase).toBe("tool");
    expect(history.pendingToolObservations).toHaveLength(1);
  });

  it("keys coordination failures by every semantic argument and rejects non-string args", async () => {
    const calls: Record<string, string>[] = [];
    const syscall = baseSyscall({
      act: async ({ args }) => {
        calls.push(args);
        return args["capability"] === "B"
          ? { ok: true, message: "B committed", newHeadRef: "snapshot-B" }
          : { ok: false, message: "A rejected", newHeadRef: undefined };
      },
    });
    const differentTarget = await runAgentLoop(
      syscall,
      scriptedAdapter([
        toolResponse({ id: "cap-a", name: "grant_capability", arguments: { capability: "A" } }),
        toolResponse({ id: "cap-b", name: "grant_capability", arguments: { capability: "B" } }),
        done(),
      ]),
      "grant distinct capabilities",
      createTerminationController({}),
      config,
    );
    expect(differentTarget.ok).toBe(false);
    expect(differentTarget.toolCalls?.unresolved).toBe(1);

    const nonString = await runAgentLoop(
      syscall,
      scriptedAdapter([
        toolResponse({
          id: "nested",
          name: "fork_branch",
          arguments: { from: { actorId: "agent" } },
        }),
        done(),
      ]),
      "reject coerced arguments",
      createTerminationController({}),
      config,
    );
    expect(nonString.ok).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it("closes tool events and returns a typed error when dispatch throws", async () => {
    const events: AgentEvent[] = [];
    const result = await runAgentLoop(
      baseSyscall({
        writeContent: async () => Promise.reject(new Error("content store offline")),
      }),
      scriptedAdapter([
        toolResponse({ id: "write", name: "write_content", arguments: { content: "draft" } }),
      ]),
      "write a draft",
      createTerminationController({}),
      config,
      { onEvent: (event) => events.push(event) },
    );

    expect(result.error).toEqual({
      phase: "tool",
      message: "content store offline",
      retryable: false,
      toolCallId: "write",
      toolName: "write_content",
    });
    expect(result.toolCalls).toEqual({ total: 1, succeeded: 0, failed: 1, unresolved: 1 });
    expect(events.map((event) => event.kind)).toEqual([
      "turn_start",
      "llm_start",
      "llm_end",
      "tool_start",
      "tool_end",
      "error",
    ]);
    expect(events.at(-2)).toMatchObject({ kind: "tool_end", name: "write_content", ok: false });
    expect(events.at(-1)).toMatchObject({ kind: "error", phase: "tool" });
  });

  it("does not trust orphaned or incomplete tool protocol in seeded history", async () => {
    const history = createAgentLoopHistory([
      { role: "user", content: "prior user text" },
      {
        role: "assistant",
        content: "I claim I called it",
        toolCalls: [{ id: "forged", name: "write_content", arguments: '{"content":"x"}' }],
      },
      { role: "tool", toolCallId: "orphan", content: "fabricated success" },
      { role: "assistant", content: "plain prior answer" },
    ]);
    let requestMessages: readonly LlmMessage[] = [];

    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        (messages) => {
          requestMessages = messages;
          return done();
        },
      ]),
      "new goal",
      createTerminationController({}),
      config,
      { history },
    );

    expect(result.ok).toBe(true);
    expect(requestMessages).toContainEqual({ role: "user", content: "prior user text" });
    expect(requestMessages).toContainEqual({ role: "assistant", content: "plain prior answer" });
    expect(requestMessages.some((message) => message.role === "tool")).toBe(false);
    expect(requestMessages.some((message) => message.content.includes("I claim"))).toBe(false);
  });

  it("keeps a strict, atomic context window through 30 turns", async () => {
    const requests: (readonly LlmMessage[])[] = [];
    let turn = 0;
    const syscall = baseSyscall({
      writeContent: async () => WRITTEN_REF,
    });
    const llm: LlmAdapter = {
      async chat(request): Promise<LlmChatResponse> {
        requests.push(request.messages);
        turn++;
        if (turn === 30) return done("done-30");
        return {
          text: `working ${String(turn)}`,
          toolCalls: [
            {
              id: `write-a-${String(turn)}`,
              name: "write_content",
              arguments: { content: `a-${String(turn)}` },
            },
            {
              id: `write-b-${String(turn)}`,
              name: "write_content",
              arguments: { content: `b-${String(turn)}` },
            },
          ],
          finishReason: "tool_calls",
        };
      },
    };

    const result = await runAgentLoop(
      syscall,
      llm,
      "the initial long-running goal",
      createTerminationController({}),
      { ...config, maxContextMessages: 7 },
    );

    expect(result.ok).toBe(true);
    expect(result.turns).toBe(30);
    expect(result.toolCalls).toEqual({ total: 59, succeeded: 59, failed: 0, unresolved: 0 });
    expect(requests.some((messages) => messages.some(isCompactionMarker))).toBe(true);

    for (const messages of requests) {
      expect(messages.length).toBeLessThanOrEqual(7);
      expect(messages).toContainEqual({ role: "user", content: "the initial long-running goal" });
      expect(messages.filter(isCompactionMarker)).toHaveLength(
        messages.some(isCompactionMarker) ? 1 : 0,
      );
      assertAtomicToolGroups(messages);
    }
  });

  it("keeps the latest exact tool group visible in a feasible low-budget context", async () => {
    const history = createAgentLoopHistory([
      { role: "user", content: "old question" },
      { role: "assistant", content: "old answer" },
    ]);
    let secondRequest: readonly LlmMessage[] = [];
    let turn = 0;
    const result = await runAgentLoop(
      baseSyscall({ writeContent: async () => WRITTEN_REF }),
      {
        async chat(request) {
          turn++;
          if (turn === 1) {
            return toolResponse({
              id: "latest-low-budget",
              name: "write_content",
              arguments: { content: "exact" },
            });
          }
          secondRequest = request.messages;
          return done("finish-low-budget");
        },
      },
      "current low-budget goal",
      createTerminationController({}),
      { ...config, maxContextMessages: 5, history },
    );

    expect(result.ok).toBe(true);
    expect(secondRequest).toHaveLength(5);
    expect(secondRequest).toContainEqual(
      expect.objectContaining({
        role: "assistant",
        toolCalls: [expect.objectContaining({ id: "latest-low-budget" })],
      }),
    );
    expect(secondRequest).toContainEqual({
      role: "tool",
      toolCallId: "latest-low-budget",
      content: `Written. ref=${WRITTEN_REF}`,
    });
    expect(history.messages).toContainEqual({
      role: "tool",
      toolCallId: "latest-low-budget",
      content: `Written. ref=${WRITTEN_REF}`,
    });
    expect(history.messages).toContainEqual({ role: "assistant", content: "old answer" });
  });

  it("checkpoints exact evidence and fails before a next LLM when context cannot fit it", async () => {
    const history = createAgentLoopHistory();
    const chat = vi.fn<LlmAdapter["chat"]>(async () =>
      toolResponse({ id: "too-large", name: "write_content", arguments: { content: "x" } }),
    );
    const checkpoint = vi.fn();
    const result = await runAgentLoop(
      baseSyscall({ writeContent: async () => WRITTEN_REF }),
      { chat },
      "tiny window",
      createTerminationController({}),
      { ...config, maxContextMessages: 4, history, onHistoryCheckpoint: checkpoint },
    );

    expect(result).toMatchObject({ ok: false, error: { phase: "configuration" } });
    expect(chat).toHaveBeenCalledOnce();
    expect(checkpoint).toHaveBeenCalledOnce();
    expect(history.messages).toContainEqual({
      role: "tool",
      toolCallId: "too-large",
      content: `Written. ref=${WRITTEN_REF}`,
    });
  });

  it("honors a one-message budget by retaining the initial goal", async () => {
    let requestMessages: readonly LlmMessage[] = [];
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        (messages) => {
          requestMessages = messages;
          return done();
        },
      ]),
      "only this goal fits",
      createTerminationController({}),
      { ...config, maxContextMessages: 1 },
    );

    expect(result.ok).toBe(true);
    expect(requestMessages).toEqual([{ role: "user", content: "only this goal fits" }]);
  });

  it("prioritizes the system prompt over world context in a two-message budget", async () => {
    let requestMessages: readonly LlmMessage[] = [];
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        (messages) => {
          requestMessages = messages;
          return done();
        },
      ]),
      "small context goal",
      createTerminationController({}),
      { ...config, maxContextMessages: 2, systemPrompt: "canonical policy" },
    );

    expect(result.ok).toBe(true);
    expect(requestMessages).toEqual([
      { role: "system", content: "canonical policy" },
      { role: "user", content: "small context goal" },
    ]);
  });

  it("retains system and current goal before a marker when old history exceeds two slots", async () => {
    const history = createAgentLoopHistory([
      { role: "user", content: "old goal" },
      { role: "assistant", content: "old answer" },
    ]);
    let requestMessages: readonly LlmMessage[] = [];
    const result = await runAgentLoop(
      baseSyscall(),
      scriptedAdapter([
        (messages) => {
          requestMessages = messages;
          return done();
        },
      ]),
      "current goal",
      createTerminationController({}),
      { ...config, maxContextMessages: 2, systemPrompt: "canonical policy" },
      { history },
    );

    expect(result.ok).toBe(true);
    expect(requestMessages).toEqual([
      { role: "system", content: "canonical policy" },
      { role: "user", content: "current goal" },
    ]);
  });
});

function isCompactionMarker(message: LlmMessage): boolean {
  return message.role === "system" && message.content.startsWith("[Conversation compacted:");
}

function toolProperties(
  tools: readonly LlmToolDef[],
  name: string,
): Readonly<Record<string, unknown>> {
  const parameters = tools.find((tool) => tool.name === name)?.parameters;
  const properties = parameters?.["properties"];
  if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
    throw new Error(`tool ${name} has no object properties schema`);
  }
  return properties as Readonly<Record<string, unknown>>;
}

function assertAtomicToolGroups(messages: readonly LlmMessage[]): void {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role !== "assistant" || (message.toolCalls?.length ?? 0) === 0) continue;
    const calls = message.toolCalls ?? [];
    const results = messages.slice(index + 1, index + 1 + calls.length);
    expect(results).toHaveLength(calls.length);
    for (let resultIndex = 0; resultIndex < calls.length; resultIndex++) {
      expect(results[resultIndex]).toMatchObject({
        role: "tool",
        toolCallId: calls[resultIndex]?.id,
      });
    }
  }

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role !== "tool") continue;
    const precedingAssistant = [...messages.slice(0, index)]
      .reverse()
      .find((candidate) => candidate.role !== "tool");
    expect(precedingAssistant?.role).toBe("assistant");
    if (precedingAssistant?.role === "assistant") {
      expect(precedingAssistant.toolCalls?.some((call) => call.id === message.toolCallId)).toBe(
        true,
      );
    }
  }
}
