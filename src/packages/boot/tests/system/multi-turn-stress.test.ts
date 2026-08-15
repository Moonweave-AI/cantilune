import { describe, it, expect } from "vitest";
import { bootMemoryOS } from "../../src/index.js";
import type { LlmAdapter, LlmChatResponse, ProgressEvent } from "../../src/types.js";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

describe("boot system — multi-turn stress and resource limits", () => {
  it("handles 20+ turns with sustained tool work", async () => {
    // Stress the loop with >15 turns. Each turn is a non-done write_content call,
    // which returns control without a termination verdict, so the loop keeps
    // running until the done tool call at turn 20. (Mixed plain-text turns
    // cannot be exercised here: under the default contract a single distinct
    // plain-text reply verdicts DONE, so a text turn would end the run early
    // rather than stress it. Tool turns are the correct way to hold the loop
    // open for a stress run.)
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn < 20)
          return {
            text: undefined,
            toolCalls: [
              { id: `w${turn}`, name: "write_content", arguments: { content: `content-${turn}` } },
            ],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [
            { id: "done", name: "done", arguments: { summary: `Completed after ${turn} turns` } },
          ],
          finishReason: "tool_calls",
        };
      },
    };

    const os = bootMemoryOS(llm, { llm: mockLlmConfig, maxTurns: 30, maxContextMessages: 10 });
    const result = await os.run("stress test");
    expect(result.ok).toBe(true);
    expect(result.turns).toBeGreaterThan(15);
    expect(result.producedRefs.length).toBeGreaterThan(10);
  });

  it("AbortSignal mid-loop aborts cleanly", async () => {
    const controller = new AbortController();
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn === 3) controller.abort();
        return {
          text: `turn ${turn}`,
          toolCalls: [{ id: `t${turn}`, name: "write_content", arguments: { content: "x" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const os = bootMemoryOS(llm, { llm: mockLlmConfig, maxTurns: 100 });
    const result = await os.run("long task", { signal: controller.signal });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("aborted");
    expect(result.turns).toBeGreaterThanOrEqual(3);
  });

  it("progress callback fires for every turn", async () => {
    // Progress marks the end of each turn, independently of the controller's
    // verdict — including the turn that ends in a done-tool call (the verdict
    // runs after progress is emitted). So every executed turn produces one
    // progress event: 5 write_content turns + 1 done turn = 6 events.
    let turn = 0;
    const llm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        turn++;
        if (turn <= 5)
          return {
            text: undefined,
            toolCalls: [
              { id: `t${turn}`, name: "write_content", arguments: { content: `c${turn}` } },
            ],
            finishReason: "tool_calls",
          };
        return {
          text: undefined,
          toolCalls: [{ id: "d", name: "done", arguments: { summary: "done" } }],
          finishReason: "tool_calls",
        };
      },
    };

    const events: ProgressEvent[] = [];
    const os = bootMemoryOS(llm, { llm: mockLlmConfig, maxTurns: 20 });
    await os.run("progress test", { onProgress: (e) => events.push(e) });
    expect(events).toHaveLength(6);
    expect(events[0]?.turn).toBe(1);
    expect(events[5]?.turn).toBe(6);
  });
});
