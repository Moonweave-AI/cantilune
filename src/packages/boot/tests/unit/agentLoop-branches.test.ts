import { describe, it, expect } from "vitest";
import { runAgentLoop, createTerminationController } from "../../src/index.js";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import type { AgentEvent, LlmAdapter, LlmChatResponse } from "../../src/types.js";
import type { Syscall, SyscallRuntime, ToolExecutor } from "@cantilune/syscall";
import { operationTypeId } from "@cantilune/core";

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
      return { ok: true, snapshot: snap, entry: input };
    },
    changes: () => [],
    proposeAndCommit: () => ({ ok: true, newHeadRef: snap.snapshotRef }),
  };
}

describe("runAgentLoop branch coverage", () => {
  it("terminates on finishReason 'error' from LLM", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return { text: "error happened", toolCalls: [], finishReason: "error" };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
  });

  it("terminates on finishReason 'length' (truncated response)", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return { text: "partial...", toolCalls: [], finishReason: "length" };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
  });

  it("handles write_content with empty content argument", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [{ id: "w", name: "write_content", arguments: { content: "" } }],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.producedRefs).toHaveLength(0);
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
  });

  it("handles write_content with mimeType argument", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [
              {
                id: "w",
                name: "write_content",
                arguments: { content: "hi", mimeType: "application/json" },
              },
            ],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(true);
    expect(result.toolCalls?.unresolved).toBe(0);
    expect(result.producedRefs).toHaveLength(1);
  });

  it("handles read_content with valid ref that exists", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const ref = await store.put("test content", { mimeType: "text/plain", createdBy: "test" });
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [{ id: "r", name: "read_content", arguments: { ref: ref as string } }],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(true);
  });

  it("handles read_content with non-existent ref", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [
              { id: "r", name: "read_content", arguments: { ref: "sha256:nonexistent" } },
            ],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.toolCalls?.unresolved).toBe(1);
  });

  it("handles unknown tool via default act dispatch", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const artifactContentRef = await store.put("Task body");
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("introduce_artifact"),
        description: "Intro",
        requiredRoles: ["task", "from"],
        contentRefInputs: [{ name: "contentRef", required: true }],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: "acting",
            toolCalls: [
              {
                id: "a",
                name: "introduce_artifact",
                arguments: { task: "x", from: "t", contentRef: artifactContentRef },
              },
            ],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(true);
  });

  it("handles act that returns ok: false from runtime", async () => {
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
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: false, message: "rejected" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("fork_branch"),
        description: "Fork",
        requiredRoles: ["from"],
      },
    ]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [{ id: "f", name: "fork_branch", arguments: { from: "t" } }],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    // The rejection is surfaced rather than absorbed: nothing was committed.
    expect(result.operations).toEqual({ committed: 0, rejected: 1 });
    expect(result.ok).toBe(false);
  });

  it("catches non-Error thrown from LLM", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        throw "string error";
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("string error");
    expect(result.terminationReason).toBe("error");
  });

  it("returns a typed phase error when availableActions throws", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const phases: string[] = [];
    const result = await runAgentLoop(
      { ...syscall, availableActions: async () => Promise.reject(new Error("schema offline")) },
      llm,
      "test",
      detector,
      { maxTurns: 100, maxTimeMs: 600_000, maxContextMessages: 40 },
      {
        onEvent: (event) => {
          if (event.kind === "error") phases.push(event.phase);
        },
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      phase: "available_actions",
      message: "schema offline",
      retryable: false,
    });
    expect(phases).toEqual(["available_actions"]);
  });

  it("handles tool: prefix action via useTool dispatch", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async (name, _args) => ({ ok: true, output: `result-${name}` }),
      listTools: async () => [{ name: "search", description: "Search", parameters: {} }],
    };
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
      toolExecutor,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [{ id: "t", name: "tool:search", arguments: { query: "test" } }],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(true);
    expect(result.toolCalls?.unresolved).toBe(0);
  });

  it("rejects done when external output was stored but its audit observation failed", async () => {
    const toolExecutor: ToolExecutor = {
      execute: async () => ({ ok: true, output: "tool result" }),
      listTools: async () => [],
    };
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
      observe: () => ({ ok: false, message: "observe failed" }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
      toolExecutor,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [{ id: "t", name: "tool:x", arguments: {} }],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const events: AgentEvent[] = [];
    const detector = createTerminationController({});
    const result = await runAgentLoop(
      syscall,
      llm,
      "test",
      detector,
      {
        maxTurns: 100,
        maxTimeMs: 600_000,
        maxContextMessages: 40,
      },
      {
        onEvent: (event) => events.push(event),
      },
    );
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 0, failed: 2, unresolved: 1 });
    expect(result.producedRefs).toHaveLength(1);
    // ADR-0016: the external-tool path now writes the pre-invocation journal
    // (dispatched + completed) alongside the durable output and its
    // observation-recovery receipt — four retained blobs for one external call.
    expect(await store.count()).toBe(4);
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: "tool_end",
        name: "tool:x",
        ok: false,
        output: expect.stringContaining("Observation rejected: observe failed"),
      }),
    );
  });

  it("handles tool: prefix action with no tool executor configured", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [{ id: "t", name: "tool:missing", arguments: {} }],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.toolCalls?.unresolved).toBe(1);
  });

  it("terminates via checkRunLimits when turn count reaches max before next LLM call", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return {
          text: "still working",
          toolCalls: [{ id: "w", name: "write_content", arguments: { content: "partial" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 2,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("max_turns");
    expect(result.summary).toContain("Turn limit exceeded (2)");
    expect(result.turns).toBe(2);
  });

  it("fails closed when the controller cannot perceive the world (evaluateTurn perceive fault)", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
      ...({} as object),
    });
    // Override perceive to fail after the turn-start perception succeeds, so the
    // controller's end-of-turn perceive surfaces a structured perceive-phase fault.
    const basePerceive = syscall.perceive.bind(syscall);
    let perceiveCount = 0;
    (syscall as { perceive: Syscall["perceive"] }).perceive = async () => {
      perceiveCount++;
      // First call (turn-start prepareTurn) succeeds; the controller's call fails.
      if (perceiveCount <= 1) return basePerceive();
      throw new Error("controller perceive failed");
    };

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return { text: "Finished thinking.", toolCalls: [], finishReason: "stop" };
      },
    };

    const result = await runAgentLoop(syscall, llm, "test", createTerminationController({}), {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
    expect(result.error?.phase).toBe("perceive");
    expect(result.error?.message).toContain("controller perceive failed");
  });

  it("degrades to the system default contract when contract compilation throws", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return { text: "hello back", toolCalls: [], finishReason: "stop" };
      },
    };

    // A controller whose compileContract always rejects: the loop must fall back
    // to defaultSystemContract and still reach a normal DONE on a plain-text turn.
    const failingController = {
      async compileContract(): Promise<never> {
        throw new Error("compile unavailable");
      },
      async evaluateTurn(): Promise<{ kind: "DONE" }> {
        return { kind: "DONE" } as { kind: "DONE" };
      },
      contract: () => undefined,
    };
    const result = await runAgentLoop(syscall, llm, "test", failingController as never, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    // The loop reached DONE via the fallback contract — compilation failure did
    // not abort the run.
    expect(result.ok).toBe(true);
    expect(result.terminationReason).toBe("controller");
  });

  it("fails closed when a controller missing required methods is supplied", async () => {
    const runtime = createMockRuntime();
    const syscall = createSyscall({
      runtime,
      contentStore: createMemoryContentStore(),
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
    });
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return { text: "not done", toolCalls: [], finishReason: "stop" };
      },
    };

    // A controller stub that throws on compileContract and on evaluateTurn —
    // the loop's compileContract fallback runs, then evaluateTurn throws, which
    // surfaces as a hard runtime error rather than an infinite loop.
    const throwingController = {
      async compileContract(): Promise<never> {
        throw new Error("no compile");
      },
      async evaluateTurn(): Promise<never> {
        throw new Error("controller evaluate failed");
      },
      contract: () => undefined,
    };
    const result = await runAgentLoop(syscall, llm, "test", throwingController as never, {
      maxTurns: 100,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
  });

  it("handles max_time termination", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });

    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return {
          text: "thinking",
          toolCalls: [{ id: "x", name: "write_content", arguments: { content: "y" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 1000,
      maxTimeMs: 1,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("max_time");
  });

  it("invokes onBeforeTurn before availableActions", async () => {
    const order: string[] = [];
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([]);
    const original = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: provider,
    });
    const syscall: Syscall = {
      ...original,
      availableActions: async () => {
        order.push("availableActions");
        return original.availableActions();
      },
    };
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return {
          text: undefined,
          toolCalls: [{ id: "tc-1", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };
    const result = await runAgentLoop(syscall, llm, "test", createTerminationController({}), {
      maxTurns: 10,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
      onBeforeTurn: (turn) => {
        order.push(`before:${turn}`);
      },
    });
    expect(result.ok).toBe(true);
    expect(order[0]).toBe("before:1");
    expect(order).toContain("availableActions");
    expect(order.indexOf("before:1")).toBeLessThan(order.indexOf("availableActions"));
  });

  it("fail-closes the turn when onBeforeTurn throws", async () => {
    const runtime = createMockRuntime();
    const store = createMemoryContentStore();
    const syscall = createSyscall({
      runtime,
      contentStore: store,
      principal: { actorId: "t", kind: "agent" },
      schemaProvider: createStaticSchemaProvider([]),
    });
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return { text: "should not run", toolCalls: [], finishReason: "stop" };
      },
    };
    const result = await runAgentLoop(syscall, llm, "test", createTerminationController({}), {
      maxTurns: 10,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
      onBeforeTurn: () => {
        throw new Error("pending attach failed");
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("pending attach failed");
  });
});
