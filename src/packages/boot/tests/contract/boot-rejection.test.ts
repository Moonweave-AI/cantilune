import { describe, it, expect } from "vitest";
import { bootMemoryOS, runAgentLoop, createTerminationController } from "../../src/index.js";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import type { LlmAdapter, LlmChatResponse } from "../../src/types.js";
import type { SyscallRuntime, ProposeResult } from "@cantilune/syscall";
import { operationTypeId } from "@cantilune/core";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

describe("boot contract — rejection and failure scenarios", () => {
  it("fails gracefully when LLM always errors", async () => {
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        throw new Error("rate limited");
      },
    };

    const os = bootMemoryOS(llm, { llm: mockLlmConfig });
    const result = await os.run("anything");
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("rate limited");
    expect(result.terminationReason).toBe("error");
  });

  it("terminates at maxTurns limit and reports correctly", async () => {
    // The loop runs past maxTurns only when no termination verdict fires first.
    // A repeated plain-text "thinking forever" no longer reaches maxTurns: a
    // single distinct reply verdicts DONE, and a duplicated reply stalls. To
    // exercise the hard turn boundary in isolation, drive the loop with a
    // non-done tool call each turn — tool turns return control without a
    // verdict, so the only thing that can stop the loop is the turn limit.
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
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return {
          text: undefined,
          toolCalls: [{ id: "f", name: "fork_branch", arguments: { from: "t" } }],
          finishReason: "tool_calls",
        };
      },
    };
    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "loop forever", detector, {
      maxTurns: 2,
      maxTimeMs: 60_000,
      maxContextMessages: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("max_turns");
    expect(result.turns).toBeLessThanOrEqual(2);
  });

  it("handles act with violations array error format", async () => {
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
      proposeAndCommit: () => ({ ok: false, message: "footprint conflict; ERR_001" }),
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
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "handled" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 50,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    // The loop survives the rejection, and the run reports that it changed
    // nothing rather than inheriting the agent's "handled" claim.
    expect(result.operations).toEqual({ committed: 0, rejected: 1 });
    expect(result.ok).toBe(false);
  });

  it("handles act with empty/null result from runtime", async () => {
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
      proposeAndCommit: () => null as unknown as ProposeResult,
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
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "handled" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const detector = createTerminationController({});
    const result = await runAgentLoop(syscall, llm, "test", detector, {
      maxTurns: 50,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.operations).toEqual({ committed: 0, rejected: 1 });
    expect(result.ok).toBe(false);
  });

  it("handles act with unsupported binding roles (no valid bindings)", async () => {
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
    const store = createMemoryContentStore();
    const provider = createStaticSchemaProvider([
      {
        operationTypeId: operationTypeId("custom_op"),
        description: "Custom",
        requiredRoles: ["x_unsupported"],
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
            toolCalls: [{ id: "c", name: "custom_op", arguments: { x_unsupported: "val" } }],
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
      maxTurns: 50,
      maxTimeMs: 600_000,
      maxContextMessages: 40,
    });
    expect(result.operations).toEqual({ committed: 0, rejected: 1 });
    expect(result.ok).toBe(false);
  });
});
