import { describe, it, expect } from "vitest";
import {
  bootMemoryOS,
  bootCantilune,
  BOOT_EPOCH_ID,
  wrapCoordinationRuntime,
} from "../../src/index.js";
import { uuidIdGenerator } from "../../src/bootCantilune.js";
import {
  actorId,
  collaborationSnapshot,
  participant,
  snapshotRef,
  timestamp,
} from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import type { LlmAdapter, LlmChatResponse, LlmMessage } from "../../src/types.js";
import type { SyscallRuntime, ToolExecutor } from "@cantilune/syscall";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

describe("boot integration — full agent loop lifecycle", () => {
  it("runs multi-turn loop with tool calls and content operations", async () => {
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(request): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: "Writing content",
            toolCalls: [{ id: "w", name: "write_content", arguments: { content: "hello" } }],
            finishReason: "tool_calls",
          };
        if (turn === 2) {
          const writeResult = request.messages.find(
            (message) => message.role === "tool" && message.toolCallId === "w",
          );
          const ref = writeResult?.content.match(/ref=(\S+)/u)?.[1] ?? "missing-ref";
          return {
            text: "Reading back",
            toolCalls: [{ id: "r", name: "read_content", arguments: { ref } }],
            finishReason: "tool_calls",
          };
        }
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "Multi-turn complete" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const os = bootMemoryOS(llm, {
      llm: mockLlmConfig,
      principalId: "integration-agent",
      maxTurns: 10,
    });
    const result = await os.run("Do multi-turn work");
    expect(result.ok).toBe(true);
    expect(result.turns).toBe(3);
    expect(result.producedRefs).toHaveLength(1);
    expect(result.terminationReason).toBe("controller");
  });

  it("bootCantilune with external tools integrates tool executor", async () => {
    const toolExec: ToolExecutor = {
      async execute(name, args) {
        return { ok: true, output: `executed:${name}:${JSON.stringify(args)}` };
      },
      async listTools() {
        return [
          {
            name: "file_read",
            description: "Read file",
            parameters: { type: "object", properties: { path: { type: "string" } } },
          },
        ];
      },
    };

    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1)
          return {
            text: undefined,
            toolCalls: [{ id: "t", name: "tool:file_read", arguments: { path: "/test.txt" } }],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "Tool used" } }],
          finishReason: "tool_calls",
        };
      },
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
      observe: () => ({ ok: true }),
      changes: () => [],
      proposeAndCommit: () => ({ ok: true, newHeadRef: "snapshot-committed" }),
    };
    const contentStore = createMemoryContentStore();
    const os = bootCantilune({
      runtime,
      contentStore,
      llmAdapter: llm,
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: { provider: "mock", model: "mock" },
        tools: [toolExec],
      },
    });

    const result = await os.run("Use a tool");
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("Tool used");
  });

  it("respects custom systemPrompt in config", async () => {
    let capturedMessages: readonly LlmMessage[] = [];
    const llm: LlmAdapter = {
      async chat(req): Promise<LlmChatResponse> {
        capturedMessages = req.messages;
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const os = bootMemoryOS(llm, { llm: mockLlmConfig, systemPrompt: "You are a test agent." });
    await os.run("hello");
    expect(capturedMessages[0]?.content).toBe("You are a test agent.");
  });

  it("runs real coordination ops through wrapCoordinationRuntime (session + fork ids)", async () => {
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1) {
          return {
            text: undefined,
            toolCalls: [
              { id: "s", name: "create_session", arguments: { from: "integration-agent" } },
            ],
            finishReason: "tool_calls",
          };
        }
        if (turn === 2) {
          return {
            text: undefined,
            toolCalls: [{ id: "f", name: "fork_branch", arguments: { from: "integration-agent" } }],
            finishReason: "tool_calls",
          };
        }
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "Coordination complete" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const os = bootMemoryOS(llm, {
      llm: mockLlmConfig,
      principalId: "integration-agent",
      maxTurns: 10,
    });

    // A rejected syscall is reported to the LLM as a tool error and the loop
    // still finishes "ok", so asserting on the run result alone cannot tell an
    // admitted coordination operation from a rejected one. Watch the tool
    // events instead.
    const toolEnds: { name: string; ok: boolean; output: string }[] = [];
    const result = await os.run("Coordinate", {
      onEvent: (event) => {
        if (event.kind === "tool_end") {
          toolEnds.push({ name: event.name, ok: event.ok, output: event.output });
        }
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toBe("Coordination complete");
    expect(result.turns).toBe(3);

    const coordination = toolEnds.filter((entry) => entry.name !== "done");
    expect(coordination.map((entry) => entry.name)).toEqual(["create_session", "fork_branch"]);
    for (const entry of coordination) {
      expect(entry.output).not.toContain("epoch_mismatch");
      expect(entry.ok).toBe(true);
    }
  });

  it("persists exact heartbeat scalars through boot, syscall, runtime, and replay", async () => {
    const principal = actorId("heartbeat-e2e-agent");
    const initial = collaborationSnapshot({
      snapshotRef: snapshotRef("heartbeat-e2e-t0"),
      epochId: BOOT_EPOCH_ID,
      participants: new Map([[principal, participant(principal, "agent")]]),
    });
    const persistence = createMemoryRuntimePersistence({ initial });
    const contentStore = createMemoryContentStore();
    const coordinationRuntime = createCoordinationRuntime(
      runtimeDependenciesWithStaticSchema({
        durable: persistence.durable,
        clock: { now: () => timestamp("2026-08-13T09:00:00Z") },
        idGen: uuidIdGenerator(),
        schema: createDefaultSchema(),
        activeEpochId: BOOT_EPOCH_ID,
        policy: templateAwarePolicyEvaluator(),
        handlers: createDefaultHandlers(),
        locks: new MemoryResourceLockTable(),
        contentRefAuthority: contentStore,
      }),
    );
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 1) {
          return {
            text: undefined,
            toolCalls: [
              {
                id: "heartbeat",
                name: "emit_heartbeat",
                arguments: {
                  from: principal,
                  turnCount: "37",
                  lastAction: "write_content",
                },
              },
            ],
            finishReason: "tool_calls",
          };
        }
        return {
          text: undefined,
          toolCalls: [{ id: "done", name: "done", arguments: { summary: "heartbeat recorded" } }],
          finishReason: "tool_calls",
        };
      },
    };
    const os = bootCantilune({
      runtime: wrapCoordinationRuntime(coordinationRuntime),
      contentStore,
      llmAdapter: llm,
      config: {
        durable: "memory",
        contentStore: "memory",
        llm: mockLlmConfig,
        principalId: principal,
      },
    });

    const result = await os.run("Record an exact heartbeat");
    expect(result.ok).toBe(true);
    const heartbeat = coordinationRuntime.getHead()?.heartbeatLog.at(-1);
    expect(heartbeat).toMatchObject({
      agentId: principal,
      turnCount: 37,
      lastAction: "write_content",
      emittedAt: "2026-08-13T09:00:00Z",
    });
    const committed = persistence.durable
      .changes()
      .find((change) => change.operationTypeId === "emit_heartbeat");
    expect(committed).toBeDefined();
    expect(persistence.durable.recipeForChange(committed!)?.scalarInputs).toEqual({
      turnCount: 37,
      lastAction: "write_content",
    });
    const replayed = coordinationRuntime.replay({ fromRef: initial.snapshotRef });
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(replayed.terminal.heartbeatLog.at(-1)).toMatchObject({
        turnCount: 37,
        lastAction: "write_content",
        emittedAt: "2026-08-13T09:00:00Z",
      });
    }
  });

  /**
   * Regression: the boot snapshot's epoch and the active schema context's epoch
   * were chosen independently, so admission rejected every coordination
   * operation with `epoch_mismatch` while the loop still reported success.
   */
  it("admits coordination operations instead of rejecting them on epoch", async () => {
    // The operations from the field report, in the order the agent issued them.
    const script = [
      { id: "s", name: "create_session", arguments: { from: "epoch-agent" } },
      {
        id: "h",
        name: "emit_heartbeat",
        arguments: { from: "epoch-agent", turnCount: "1", lastAction: "create_session" },
      },
      {
        id: "r",
        name: "register_participant",
        arguments: { from: "epoch-agent", participant: "epoch-worker" },
      },
      // Impersonation: heartbeat on behalf of a peer. Must still be refused,
      // and for the right reason.
      {
        id: "h2",
        name: "emit_heartbeat",
        arguments: { from: "epoch-worker", turnCount: "3", lastAction: "register_participant" },
      },
    ];
    const failures: { name: string; output: string }[] = [];
    const succeeded: string[] = [];
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        const step = script[turn];
        turn++;
        if (step === undefined) {
          return {
            text: undefined,
            toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
            finishReason: "tool_calls",
          };
        }
        return { text: undefined, toolCalls: [step], finishReason: "tool_calls" };
      },
    };

    const os = bootMemoryOS(llm, {
      llm: mockLlmConfig,
      principalId: "epoch-agent",
      maxTurns: script.length + 2,
    });
    const result = await os.run("Coordinate", {
      onEvent: (event) => {
        if (event.kind !== "tool_end") return;
        if (event.ok) succeeded.push(event.name);
        else failures.push({ name: event.name, output: event.output });
      },
    });

    expect(failures.map((entry) => entry.output).join("\n")).not.toContain("epoch_mismatch");
    // Asserting the ops ran, not just that nothing failed, so a loop that
    // silently skips them cannot pass.
    expect(succeeded).toContain("emit_heartbeat");
    expect(succeeded).toContain("register_participant");
    // The only rejection left is the impersonated heartbeat, refused on
    // principal rather than on epoch.
    expect(result.ok).toBe(false);
    expect(failures).toEqual([
      { name: "emit_heartbeat", output: expect.stringContaining("principal_invalid") },
      { name: "done", output: expect.stringContaining("unresolved tool failure") },
    ]);
  });

  /**
   * The field report's real shape: the agent interleaves content work with
   * coordination. Tool output is observed into the audit tail, which advances
   * the head without writing a change, and the change log then has a gap the
   * commit path used to treat as a broken chain — so every coordination
   * operation after the first tool call was refused for the rest of the world's
   * life.
   */
  it("keeps coordinating after observations land between commits", async () => {
    const script = [
      { id: "s", name: "create_session", arguments: { from: "mixed-agent" } },
      {
        id: "w",
        name: "write_content",
        arguments: { content: "notes for the analysis", mimeType: "text/plain" },
      },
      {
        id: "r",
        name: "register_participant",
        arguments: { from: "mixed-agent", participant: "mixed-worker" },
      },
      { id: "w2", name: "write_content", arguments: { content: "more notes" } },
      {
        id: "h",
        name: "emit_heartbeat",
        arguments: { from: "mixed-agent", turnCount: "4", lastAction: "write_content" },
      },
    ];
    const failures: { name: string; output: string }[] = [];
    const succeeded: string[] = [];
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        const step = script[turn];
        turn++;
        if (step === undefined) {
          return {
            text: undefined,
            toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
            finishReason: "tool_calls",
          };
        }
        return { text: undefined, toolCalls: [step], finishReason: "tool_calls" };
      },
    };

    const os = bootMemoryOS(llm, {
      llm: mockLlmConfig,
      principalId: "mixed-agent",
      maxTurns: script.length + 2,
    });
    await os.run("Analyse and coordinate", {
      onEvent: (event) => {
        if (event.kind !== "tool_end") return;
        if (event.ok) succeeded.push(event.name);
        else failures.push({ name: event.name, output: event.output });
      },
    });

    expect(failures).toEqual([]);
    expect(succeeded).toContain("create_session");
    expect(succeeded).toContain("register_participant");
    expect(succeeded).toContain("emit_heartbeat");
  });

  /**
   * The agent cannot bind `from` to itself if it was never told who it is; the
   * field report showed a run wasting turns on peers' ids instead.
   */
  it("tells the agent its own actor id in the default system prompt", async () => {
    let systemPrompt = "";
    const llm: LlmAdapter = {
      async chat(req): Promise<LlmChatResponse> {
        systemPrompt = req.messages.find((m: LlmMessage) => m.role === "system")?.content ?? "";
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const os = bootMemoryOS(llm, { llm: mockLlmConfig, principalId: "who-am-i", maxTurns: 2 });
    await os.run("Identify yourself");

    expect(systemPrompt).toContain('Your actor id is "who-am-i"');
    expect(systemPrompt).toContain("principal_invalid");
  });

  it("keeps a caller-supplied systemPrompt verbatim", async () => {
    let systemPrompt = "";
    const llm: LlmAdapter = {
      async chat(req): Promise<LlmChatResponse> {
        systemPrompt = req.messages.find((m: LlmMessage) => m.role === "system")?.content ?? "";
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const os = bootMemoryOS(llm, {
      llm: mockLlmConfig,
      principalId: "who-am-i",
      systemPrompt: "Custom only.",
      maxTurns: 2,
    });
    await os.run("Identify yourself");

    expect(systemPrompt).toBe("Custom only.");
  });

  it("respects maxContextMessages config", async () => {
    let turn = 0;
    let lastMsgCount = 0;
    const llm: LlmAdapter = {
      async chat(req): Promise<LlmChatResponse> {
        lastMsgCount = req.messages.length;
        turn++;
        if (turn <= 5)
          return {
            text: `turn ${turn}`,
            toolCalls: [
              { id: `t${turn}`, name: "write_content", arguments: { content: `msg-${turn}` } },
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

    const os = bootMemoryOS(llm, { llm: mockLlmConfig, maxTurns: 10, maxContextMessages: 5 });
    await os.run("test window");
    expect(lastMsgCount).toBeLessThanOrEqual(20);
  });

  it("keeps each OS instance's private conversation across consecutive runs", async () => {
    let call = 0;
    let secondRequest: readonly LlmMessage[] = [];
    const llm: LlmAdapter = {
      async chat(request): Promise<LlmChatResponse> {
        call++;
        if (call === 2) secondRequest = request.messages;
        return {
          text: undefined,
          toolCalls: [
            {
              id: `done-${String(call)}`,
              name: "done",
              arguments: { summary: call === 1 ? "first summary" : "second summary" },
            },
          ],
          finishReason: "tool_calls",
        };
      },
    };
    const os = bootMemoryOS(llm, {
      llm: mockLlmConfig,
      principalId: "history-agent",
      maxContextMessages: 20,
    });

    expect((await os.run("first private goal")).ok).toBe(true);
    expect((await os.run("second private goal")).ok).toBe(true);

    expect(secondRequest).toContainEqual({ role: "user", content: "first private goal" });
    expect(secondRequest).toContainEqual({
      role: "assistant",
      content: "",
      toolCalls: [{ id: "done-1", name: "done", arguments: '{"summary":"first summary"}' }],
    });
    expect(secondRequest).toContainEqual({
      role: "tool",
      toolCallId: "done-1",
      content: "first summary",
    });
    expect(secondRequest).toContainEqual({ role: "user", content: "second private goal" });
  });

  it("fails a concurrent run closed instead of racing one private history", async () => {
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstTurnBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstTurnStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let calls = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        calls++;
        if (calls === 1) {
          markFirstStarted();
          await firstTurnBlocked;
        }
        return {
          text: undefined,
          toolCalls: [
            {
              id: `done-${String(calls)}`,
              name: "done",
              arguments: { summary: "complete" },
            },
          ],
          finishReason: "tool_calls",
        };
      },
    };
    const os = bootMemoryOS(llm, {
      llm: mockLlmConfig,
      principalId: "single-flight-agent",
    });

    const first = os.run("first goal");
    await firstTurnStarted;
    const concurrent = await os.run("must not enter shared history");
    expect(concurrent).toMatchObject({
      ok: false,
      turns: 0,
      terminationReason: "error",
      error: { phase: "configuration", retryable: true },
    });
    expect(concurrent.summary).toContain("single-flight");
    expect(calls).toBe(1);

    releaseFirst();
    expect((await first).ok).toBe(true);
    expect((await os.run("third goal after release")).ok).toBe(true);
    expect(calls).toBe(2);
  });
});
