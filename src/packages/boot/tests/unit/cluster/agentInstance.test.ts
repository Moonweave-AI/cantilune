/**
 * Unit tests for AgentInstance — covers constructor, abort, heartbeat timer, and loop lifecycle.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { actorId } from "@cantilune/core";
import type { AgentManifest } from "@cantilune/core";
import { ALWAYS_CONDITION } from "@cantilune/core";
import { AgentInstance } from "../../../src/cluster/agentInstance.js";
import type { SharedResources } from "../../../src/cluster/sharedResources.js";
import type { LlmAdapter, LlmChatResponse } from "../../../src/types.js";

function makeManifest(opts?: Partial<AgentManifest>): AgentManifest {
  return {
    agentId: "test-agent",
    kind: "agent",
    systemPrompt: "You are a test agent",
    assignedTask: "do something",
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
    ...opts,
  };
}

function makeShared(): SharedResources {
  return {
    runtime: { getHead: () => undefined } as never,
    contentStore: {} as never,
    meshTransport: { allocate() {}, deallocate() {} } as never,
    storagePath: "/tmp",
    humanInterface: undefined,
    eventListener: undefined,
  };
}

function makeSyscall() {
  return {
    perceive: vi.fn().mockResolvedValue({
      worldSummary: "empty",
      recentObservations: "",
      availableOperations: [
        { id: "done", description: "Signal done", parameters: { summary: { type: "string" } } },
      ],
      headRef: undefined,
    }),
    act: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
    readContent: vi.fn().mockResolvedValue({ found: false }),
    writeContent: vi.fn().mockResolvedValue("sha256:x"),
    // A successful external tool call must return a valid ContentRef; the agent
    // loop validates the observation-recovery invariant and throws otherwise.
    useTool: vi.fn().mockResolvedValue({
      ok: true,
      output: "ok",
      contentRef:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    }),
    availableActions: vi.fn().mockResolvedValue([]),
  };
}

function makeInstantDoneLlm(): LlmAdapter {
  return {
    async chat(): Promise<LlmChatResponse> {
      return {
        text: undefined,
        toolCalls: [{ id: "t1", name: "done", arguments: { summary: "completed" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

describe("AgentInstance", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores actorId and manifest from config", () => {
    const manifest = makeManifest();
    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest,
      llmAdapter: makeInstantDoneLlm(),
      syscall: makeSyscall() as never,
      shared: makeShared(),
    });
    expect(instance.actorId).toBe(actorId("test-agent"));
    expect(instance.manifest).toBe(manifest);
  });

  it("isRunning is false before start", () => {
    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest: makeManifest(),
      llmAdapter: makeInstantDoneLlm(),
      syscall: makeSyscall() as never,
      shared: makeShared(),
    });
    expect(instance.isRunning).toBe(false);
  });

  it("start executes agent loop and returns RunResult (done)", async () => {
    vi.useFakeTimers();
    const syscall = makeSyscall();
    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest: makeManifest({ maxTurns: 5 }),
      llmAdapter: makeInstantDoneLlm(),
      syscall: syscall as never,
      shared: makeShared(),
    });

    const resultPromise = instance.start();
    await vi.advanceTimersByTimeAsync(100);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    // The controller owns termination; a done-tool call that satisfies the
    // contract verdicts DONE with reason "controller", not the legacy "done".
    expect(result.terminationReason).toBe("controller");
  });

  it("abort terminates a running loop", async () => {
    // Keep the loop alive with a tool-call turn (not plain text): a single
    // distinct plain-text turn now verdicts DONE under the default contract, so
    // plain text cannot exercise a long-running loop. A non-done tool call
    // returns control without a termination verdict, so the loop keeps running
    // until the abort signal fires.
    const blockingLlm: LlmAdapter = {
      async chat() {
        // Simulate slow LLM
        await new Promise((r) => setTimeout(r, 100));
        return {
          text: undefined,
          toolCalls: [{ id: "keep", name: "tool:probe", arguments: {} }],
          finishReason: "tool_calls" as const,
        };
      },
    };

    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest: makeManifest({ maxTurns: 1000, maxTimeMs: 60_000 }),
      llmAdapter: blockingLlm,
      syscall: makeSyscall() as never,
      shared: makeShared(),
    });

    const resultPromise = instance.start();
    // Let it run a couple of turns
    await new Promise((r) => setTimeout(r, 250));
    instance.abort();

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    // abort may surface as "aborted" or "error" depending on timing
    expect(["aborted", "error"]).toContain(result.terminationReason);
    expect(instance.isRunning).toBe(false);
  });

  it("heartbeat timer calls syscall.act with emit_heartbeat", async () => {
    // Keep the loop alive with tool-call turns (not plain text): a single
    // distinct plain-text turn now verdicts DONE under the default contract.
    // A non-done tool call returns control without a termination verdict, so
    // the heartbeat timer has time to fire.
    const syscall = makeSyscall();
    let turnCount = 0;
    const slowLlm: LlmAdapter = {
      async chat() {
        turnCount++;
        // After 5 turns signal done
        if (turnCount >= 5) {
          return {
            text: undefined,
            toolCalls: [{ id: "t1", name: "done", arguments: { summary: "done" } }],
            finishReason: "tool_calls" as const,
          };
        }
        // Each turn takes 30ms
        await new Promise((r) => setTimeout(r, 30));
        return {
          text: undefined,
          toolCalls: [{ id: `keep-${turnCount}`, name: "tool:probe", arguments: {} }],
          finishReason: "tool_calls" as const,
        };
      },
    };

    const instance = new AgentInstance({
      actorId: actorId("hb-agent"),
      manifest: makeManifest({ heartbeatIntervalMs: 50, maxTurns: 10 }),
      llmAdapter: slowLlm,
      syscall: syscall as never,
      shared: makeShared(),
    });

    await instance.start();

    const heartbeatCalls = (syscall.act as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => {
        const arg = c[0] as { operation?: string };
        return arg.operation === "emit_heartbeat";
      },
    );
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(1);

    if (heartbeatCalls.length > 0) {
      const firstHb = heartbeatCalls[0]![0] as { args: Record<string, string> };
      expect(firstHb.args.from).toBe("hb-agent");
      expect(Number(firstHb.args.turnCount)).toBeGreaterThan(0);
      expect(firstHb.args.lastAction).toBe("tool:probe");
    }
  });

  it("heartbeat timer is cleaned up after loop finishes", async () => {
    vi.useFakeTimers();
    const syscall = makeSyscall();
    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest: makeManifest({ heartbeatIntervalMs: 500, maxTurns: 1 }),
      llmAdapter: makeInstantDoneLlm(),
      syscall: syscall as never,
      shared: makeShared(),
    });

    const resultPromise = instance.start();
    await vi.advanceTimersByTimeAsync(100);
    await resultPromise;

    const callsAfterDone = (syscall.act as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    const callsAfterMore = (syscall.act as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfterMore).toBe(callsAfterDone);
  });

  it("buildAgentSystemPrompt includes cluster communication guidance", async () => {
    vi.useFakeTimers();
    let capturedMessages: unknown[] = [];
    const capturingLlm: LlmAdapter = {
      async chat(req) {
        capturedMessages = req.messages as unknown[];
        return {
          text: undefined,
          toolCalls: [{ id: "t1", name: "done", arguments: { summary: "done" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest: makeManifest({ systemPrompt: "Base prompt here" }),
      llmAdapter: capturingLlm,
      syscall: makeSyscall() as never,
      shared: makeShared(),
    });

    const resultPromise = instance.start();
    await vi.advanceTimersByTimeAsync(100);
    await resultPromise;

    const systemMsg = capturedMessages[0] as { role: string; content: string };
    expect(systemMsg.role).toBe("system");
    expect(systemMsg.content).toContain("Base prompt here");
    expect(systemMsg.content).toContain("Experimental Cluster Boundary");
    expect(systemMsg.content).toContain("register_participant");
    expect(systemMsg.content).toContain("does not itself launch a process");
    expect(systemMsg.content).not.toContain("send_message");
    expect(systemMsg.content).not.toContain("ask_human");
  });

  it("maxTurns causes termination when reached", async () => {
    vi.useFakeTimers();
    // A non-done tool call each turn returns control without a termination
    // verdict, so the loop keeps running until maxTurns is reached. (Plain text
    // would not work here: a single distinct reply verdicts DONE, and a
    // repeated reply stalls — neither reaches maxTurns.)
    const neverDoneLlm: LlmAdapter = {
      async chat() {
        return {
          text: undefined,
          toolCalls: [{ id: "t", name: "tool:probe", arguments: {} }],
          finishReason: "tool_calls" as const,
        };
      },
    };

    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest: makeManifest({ maxTurns: 3 }),
      llmAdapter: neverDoneLlm,
      syscall: makeSyscall() as never,
      shared: makeShared(),
    });

    const resultPromise = instance.start();
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("max_turns");
    expect(result.turns).toBeLessThanOrEqual(3);
  });

  it("heartbeat emission failure is non-fatal (agent completes)", async () => {
    // Mock act to reject ONLY for heartbeat, succeed for others
    const syscall = {
      perceive: vi.fn().mockResolvedValue({
        worldSummary: "empty",
        recentObservations: "",
        availableOperations: [
          { id: "done", description: "Signal done", parameters: { summary: { type: "string" } } },
        ],
        headRef: undefined,
      }),
      act: vi.fn().mockImplementation(async (req: { operation: string }) => {
        if (req.operation === "emit_heartbeat") {
          throw new Error("network error");
        }
        return { ok: true, message: "ok" };
      }),
      readContent: vi.fn().mockResolvedValue({ found: false }),
      writeContent: vi.fn().mockResolvedValue("sha256:x"),
      useTool: vi.fn().mockResolvedValue({
        ok: true,
        output: "ok",
        contentRef:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      }),
      availableActions: vi.fn().mockResolvedValue([]),
    };

    let turnCount = 0;
    const llm: LlmAdapter = {
      async chat() {
        turnCount++;
        if (turnCount >= 3) {
          return {
            text: undefined,
            toolCalls: [{ id: "t1", name: "done", arguments: { summary: "ok" } }],
            finishReason: "tool_calls" as const,
          };
        }
        // Wait a bit so heartbeat has a chance to fire. Keep the loop alive
        // with a non-done tool call: a single distinct plain-text turn verdicts
        // DONE under the default contract and would never let the heartbeat fire.
        await new Promise((r) => setTimeout(r, 60));
        return {
          text: undefined,
          toolCalls: [{ id: `keep-${turnCount}`, name: "tool:probe", arguments: {} }],
          finishReason: "tool_calls" as const,
        };
      },
    };

    const instance = new AgentInstance({
      actorId: actorId("test-agent"),
      manifest: makeManifest({ heartbeatIntervalMs: 30, maxTurns: 5 }),
      llmAdapter: llm,
      syscall: syscall as never,
      shared: makeShared(),
    });

    const result = await instance.start();
    expect(result.ok).toBe(true);
    expect(result.terminationReason).toBe("controller");
  });

  it("fails closed when the runtime explicitly rejects a heartbeat", async () => {
    vi.useFakeTimers();
    const syscall = makeSyscall();
    syscall.act.mockResolvedValue({
      ok: false,
      message: "epoch_mismatch",
      newHeadRef: undefined,
    });
    const llm: LlmAdapter = {
      async chat() {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        return { text: "late", toolCalls: [], finishReason: "stop" as const };
      },
    };
    const instance = new AgentInstance({
      actorId: actorId("rejected-heartbeat-agent"),
      manifest: makeManifest({ heartbeatIntervalMs: 10, maxTurns: 5 }),
      llmAdapter: llm,
      syscall: syscall as never,
      shared: makeShared(),
    });

    const resultPromise = instance.start();
    await vi.advanceTimersByTimeAsync(20);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("aborted");
    expect(instance.isRunning).toBe(false);
  });
});
