// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmAdapter, LlmChatRequest, LlmChatResponse, RunResult } from "@cantilune/boot";
import { ReactiveStore } from "../../src/store.js";

const adapters = vi.hoisted(() => {
  let oldRef = "";
  let firstTurn = 0;
  let replacementTurn = 0;
  const replacementRequests: LlmChatRequest[] = [];

  const first: LlmAdapter = {
    async chat(): Promise<LlmChatResponse> {
      firstTurn++;
      return firstTurn === 1
        ? {
            text: undefined,
            toolCalls: [
              {
                id: "write-old-world",
                name: "write_content",
                arguments: { content: "old-memory-world-content" },
              },
            ],
            finishReason: "tool_calls",
          }
        : {
            text: undefined,
            toolCalls: [{ id: "done-old-world", name: "done", arguments: { summary: "stored" } }],
            finishReason: "tool_calls",
          };
    },
  };

  const replacement: LlmAdapter = {
    async chat(request): Promise<LlmChatResponse> {
      replacementRequests.push(request);
      replacementTurn++;
      return replacementTurn === 1
        ? {
            text: undefined,
            toolCalls: [{ id: "read-old-world", name: "read_content", arguments: { ref: oldRef } }],
            finishReason: "tool_calls",
          }
        : {
            text: undefined,
            toolCalls: [
              { id: "done-new-world", name: "done", arguments: { summary: "claimed read" } },
            ],
            finishReason: "tool_calls",
          };
    },
  };

  return {
    first,
    replacement,
    replacementRequests,
    setOldRef(value: string) {
      oldRef = value;
    },
    reset() {
      oldRef = "";
      firstTurn = 0;
      replacementTurn = 0;
      replacementRequests.length = 0;
    },
  };
});

vi.mock("@cantilune/adapter", () => ({
  createAdapter: vi.fn((config: { model: string }) =>
    config.model === "replacement-model" ? adapters.replacement : adapters.first,
  ),
  getProvider: vi.fn(() => ({ envKeyName: "" })),
  createEmbedder: vi.fn(() => undefined),
}));

import { useAgentLoop } from "../../src/tui/hooks/useAgentLoop.js";

describe("memory provider reset with real runtime/content backends", () => {
  beforeEach(() => {
    adapters.reset();
  });

  it("does not attach old exact tool history or content refs to the replacement world", async () => {
    const store = new ReactiveStore({
      durable: "memory",
      storagePath: undefined,
      principalId: undefined,
      maxTurns: 2,
    });
    const hook = renderHook(() => useAgentLoop({ store }));

    const firstResults: (RunResult | undefined)[] = [];
    await act(async () => {
      firstResults.push(await hook.result.current.start("write in the old memory world"));
    });
    const firstResult = firstResults[0];
    expect(firstResult?.ok).toBe(true);
    const oldRef = String(firstResult?.producedRefs[0]);
    expect(oldRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
    adapters.setOldRef(oldRef);

    let resetResult: Awaited<ReturnType<typeof hook.result.current.stop>> | undefined;
    await act(async () => {
      resetResult = await hook.result.current.stop("preserve");
    });
    expect(resetResult).toEqual({ history: "cleared", reason: "memory_world_replaced" });
    expect(store.get().session.messages).toEqual([]);
    expect(store.get().notice?.text).toContain("private and visible history were cleared");

    store.set({ model: "replacement-model" });
    const replacementResults: (RunResult | undefined)[] = [];
    await act(async () => {
      replacementResults.push(await hook.result.current.start("read from the replacement world"));
    });
    const replacementResult = replacementResults[0];

    // A fresh real memory content store cannot resolve the old world's digest.
    expect(replacementResult?.ok).toBe(false);
    expect(replacementResult?.toolCalls?.unresolved).toBeGreaterThan(0);
    const replacementSeed = adapters.replacementRequests[0]?.messages ?? [];
    expect(JSON.stringify(replacementSeed)).not.toContain(oldRef);
    expect(JSON.stringify(replacementSeed)).not.toContain("write in the old memory world");
  });

  it("clears stale UI seed on the internal memory signature-mismatch recovery path", async () => {
    const store = new ReactiveStore({
      durable: "memory",
      storagePath: undefined,
      principalId: undefined,
      maxTurns: 2,
    });
    const hook = renderHook(() => useAgentLoop({ store }));

    const firstResults: (RunResult | undefined)[] = [];
    await act(async () => {
      firstResults.push(await hook.result.current.start("old visible and private request"));
    });
    const firstResult = firstResults[0];
    const oldRef = String(firstResult?.producedRefs[0]);
    adapters.setOldRef(oldRef);

    // Bypass the slash-command reset deliberately. ensureRuntime must still
    // defend its own adapter-signature recovery path.
    store.set({ model: "replacement-model" });
    const replacementResults: (RunResult | undefined)[] = [];
    await act(async () => {
      replacementResults.push(await hook.result.current.start("new-world request"));
    });
    const replacementResult = replacementResults[0];

    expect(replacementResult?.ok).toBe(false);
    expect(
      store.get().session.messages.some((message) => message.content.includes("old visible")),
    ).toBe(false);
    const replacementSeed = adapters.replacementRequests[0]?.messages ?? [];
    expect(JSON.stringify(replacementSeed)).not.toContain(oldRef);
    expect(JSON.stringify(replacementSeed)).not.toContain("old visible and private request");
  });
});
