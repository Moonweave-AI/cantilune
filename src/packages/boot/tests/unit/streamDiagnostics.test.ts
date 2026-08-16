import { describe, it, expect } from "vitest";
import { bootMemoryOS } from "../../src/index.js";
import type { LlmAdapter, LlmChatResponse, LlmStreamChunk, AgentEvent } from "../../src/types.js";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

/**
 * Build a streaming adapter from a fixed list of stream chunks. The final
 * chunk must be a `done` carrying the assembled response, mirroring how the
 * real OpenAI/Anthropic adapters terminate a stream.
 */
function streamingAdapter(chunks: readonly LlmStreamChunk[]): LlmAdapter {
  return {
    // The contract-compiler / termination-controller work made `chat` required
    // on LlmAdapter. These tests exercise the streaming path only, so provide a
    // chat stub that is never reached.
    async chat(): Promise<LlmChatResponse> {
      throw new Error("streamingAdapter does not implement chat");
    },
    async *stream(): AsyncGenerator<LlmStreamChunk> {
      for (const chunk of chunks) yield chunk;
    },
  };
}

/** A done chunk carrying a single `done` tool call — a clean completion. */
function doneChunk(summary: string): LlmStreamChunk {
  return {
    kind: "done",
    response: {
      text: undefined,
      toolCalls: [{ id: "tc-1", name: "done", arguments: { summary } }],
      finishReason: "tool_calls",
    },
  };
}

describe("consumeStream diagnostics", () => {
  it("skips a malformed tool-call delta and emits a diagnostic instead of killing the stream", async () => {
    // The adapter yields a malformed tool_call_delta (index is a string,
    // not a number) followed by a clean done. Without the consumeStream
    // tolerance, the malformed frame would throw "LLM stream yielded an
    // invalid tool-call delta" and the run would fail.
    const adapter = streamingAdapter([
      // @ts-expect-error — simulating a provider that bypassed adapter normalization
      { kind: "tool_call_delta", index: "0", argumentsDelta: '{"x":1}' },
      doneChunk("recovered"),
    ]);

    const os = bootMemoryOS(adapter, { llm: mockLlmConfig, principalId: "test-agent" });

    const diagnostics: AgentEvent[] = [];
    const result = await os.run("prove something", {
      onEvent: (event) => {
        if (event.kind === "diagnostic") diagnostics.push(event);
      },
    });

    // The run completed despite the malformed frame.
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("recovered");
    // A diagnostic was surfaced naming the offending field.
    expect(diagnostics.length).toBeGreaterThan(0);
    const first = diagnostics.find((d) => d.kind === "diagnostic");
    expect(first).toBeDefined();
    if (first !== undefined && first.kind === "diagnostic") {
      expect(first.phase).toBe("stream");
      expect(first.message).toContain("malformed tool-call delta");
      expect(first.detail).toContain("field=index");
    }
  });

  it("emits a summary diagnostic when the stream completes after skipping frames", async () => {
    const adapter = streamingAdapter([
      // Negative / non-integer indices are valid `number` at the type level;
      // consumeStream rejects them at runtime as malformed (non-integer index)
      // and skips the frame, emitting a diagnostic instead.
      { kind: "tool_call_delta", index: -1 },
      { kind: "tool_call_delta", index: 1.5 },
      doneChunk("done after skips"),
    ]);

    const os = bootMemoryOS(adapter, { llm: mockLlmConfig, principalId: "test-agent" });

    const diagnostics: AgentEvent[] = [];
    const result = await os.run("work", {
      onEvent: (event) => {
        if (event.kind === "diagnostic") diagnostics.push(event);
      },
    });

    expect(result.ok).toBe(true);
    const messages = diagnostics
      .filter((d): d is Extract<AgentEvent, { kind: "diagnostic" }> => d.kind === "diagnostic")
      .map((d) => d.message);
    // One per-frame diagnostic per malformed frame, plus a completion summary.
    expect(messages.some((m) => m.includes("skipped a malformed tool-call delta"))).toBe(true);
    expect(messages.some((m) => m.includes("completed after skipping"))).toBe(true);
  });

  it("still throws when the stream ends without a terminal chunk", async () => {
    // A stream that never yields `done` is a genuine protocol failure and
    // must remain fatal — the tolerance only applies to malformed frames.
    const adapter = streamingAdapter([{ kind: "text_delta", text: "partial" }]);

    const os = bootMemoryOS(adapter, { llm: mockLlmConfig, principalId: "test-agent" });

    const result = await os.run("work");

    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
    expect(result.summary).toContain("LLM error");
  });

  it("does not emit diagnostics for a fully well-formed stream", async () => {
    const adapter = streamingAdapter([{ kind: "text_delta", text: "Hello" }, doneChunk("clean")]);

    const os = bootMemoryOS(adapter, { llm: mockLlmConfig, principalId: "test-agent" });

    const diagnostics: AgentEvent[] = [];
    const result = await os.run("work", {
      onEvent: (event) => {
        if (event.kind === "diagnostic") diagnostics.push(event);
      },
    });

    expect(result.ok).toBe(true);
    expect(diagnostics).toEqual([]);
  });
});
