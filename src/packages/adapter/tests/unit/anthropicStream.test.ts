import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmChatRequest, LlmStreamChunk } from "@cantilune/boot";
import { createAnthropicAdapter } from "../../src/anthropic/anthropicAdapter.js";
import { AnthropicStreamAccumulator } from "../../src/anthropic/anthropicToolMapping.js";
import { requestBodyText } from "../support/requestBody.js";

const entry = {
  slug: "anthropic",
  tier: "native" as const,
  defaultBaseUrl: "https://api.anthropic.com/v1",
  envKeyName: "ANTHROPIC_API_KEY",
};

/** Serves `frames` as SSE `data:` lines followed by the `[DONE]` sentinel. */
function sseResponse(frames: readonly unknown[], { done = true } = {}): Response {
  const lines = frames.map((frame) =>
    typeof frame === "string" ? `data: ${frame}\n\n` : `data: ${JSON.stringify(frame)}\n\n`,
  );
  if (done) lines.push("data: [DONE]\n\n");

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

/** `LlmAdapter.stream` is optional on the interface, so assert support once here. */
function streamOf(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
  const adapter = createAnthropicAdapter(
    { provider: "anthropic", model: "claude-sonnet-4", apiKey: () => "test-key" },
    entry,
    { retries: 0 },
  );
  if (adapter.stream === undefined) {
    throw new Error("anthropic adapter must support streaming");
  }
  return adapter.stream(request);
}

function askHi(): LlmChatRequest {
  return { messages: [{ role: "user", content: "Hi" }], tools: [] };
}

async function collect(stream: AsyncIterable<LlmStreamChunk>): Promise<LlmStreamChunk[]> {
  const chunks: LlmStreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe("createAnthropicAdapter.stream", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("requests an event stream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]));
    globalThis.fetch = fetchMock;

    await collect(streamOf(askHi()));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ Accept: "text/event-stream" });
    expect((JSON.parse(requestBodyText(init.body)) as Record<string, unknown>).stream).toBe(true);
  });

  it("emits text deltas and a final aggregated response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        { type: "message_start", message: { usage: { input_tokens: 9 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } },
      ]),
    );

    const chunks = await collect(streamOf(askHi()));

    expect(chunks.slice(0, 2)).toEqual([
      { kind: "text_delta", text: "Hel" },
      { kind: "text_delta", text: "lo" },
    ]);
    expect(chunks.at(-1)).toEqual({
      kind: "done",
      response: {
        text: "Hello",
        toolCalls: [],
        finishReason: "stop",
        usage: { prompt: 9, completion: 2, total: 11 },
      },
    });
  });

  it("emits tool-call deltas and reassembles partial JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", id: "toolu_a", name: "search" },
        },
        { type: "content_block_delta", index: 0, delta: { partial_json: '{"q"' } },
        { type: "content_block_delta", index: 0, delta: { partial_json: ':"cantilune"}' } },
        { type: "message_delta", delta: { stop_reason: "tool_use" } },
      ]),
    );

    const chunks = await collect(streamOf(askHi()));

    expect(chunks[0]).toEqual({
      kind: "tool_call_delta",
      index: 0,
      id: "toolu_a",
      name: "search",
    });
    expect(chunks[1]).toEqual({ kind: "tool_call_delta", index: 0, argumentsDelta: '{"q"' });
    expect(chunks.at(-1)).toEqual({
      kind: "done",
      response: {
        text: undefined,
        toolCalls: [{ id: "toolu_a", name: "search", arguments: { q: "cantilune" } }],
        finishReason: "tool_calls",
      },
    });
  });

  it("skips malformed frames without killing the stream", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          { type: "content_block_delta", index: 0, delta: { text: "before" } },
          "{not json",
          { type: "content_block_delta", index: 0, delta: { text: "after" } },
        ]),
      );

    const chunks = await collect(streamOf(askHi()));

    expect(chunks.filter((chunk) => chunk.kind === "text_delta")).toEqual([
      { kind: "text_delta", text: "before" },
      { kind: "text_delta", text: "after" },
    ]);
  });

  it("surfaces an API error before yielding any chunk", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }));

    await expect(collect(streamOf(askHi()))).rejects.toThrow(
      "Anthropic API error (403): Forbidden",
    );
  });

  it("still completes when the stream ends without a [DONE] sentinel", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse(
        [
          { type: "content_block_delta", index: 0, delta: { text: "tail" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" } },
        ],
        { done: false },
      ),
    );

    const chunks = await collect(streamOf(askHi()));

    expect(chunks).toEqual([
      { kind: "text_delta", text: "tail" },
      { kind: "done", response: { text: "tail", toolCalls: [], finishReason: "stop" } },
    ]);
  });
});

describe("AnthropicStreamAccumulator", () => {
  it("ignores events that contribute nothing", () => {
    const accumulator = new AnthropicStreamAccumulator();
    expect(accumulator.push({ type: "ping" })).toBeUndefined();
    expect(accumulator.push({ type: "content_block_stop", index: 0 })).toBeUndefined();
    expect(accumulator.push({ type: "content_block_delta", index: 0, delta: {} })).toBeUndefined();
    expect(
      accumulator.push({ type: "content_block_delta", index: 0, delta: { text: "" } }),
    ).toBeUndefined();
    expect(accumulator.finish()).toEqual({
      text: undefined,
      toolCalls: [],
      finishReason: "error",
    });
  });

  it("opens a text block without treating it as a tool block", () => {
    const accumulator = new AnthropicStreamAccumulator();
    accumulator.push({ type: "content_block_start", index: 0, content_block: { type: "text" } });
    expect(accumulator.finish().toolCalls).toEqual([]);
  });

  it("drops partial JSON for a block that was never opened", () => {
    const accumulator = new AnthropicStreamAccumulator();
    expect(
      accumulator.push({ type: "content_block_delta", index: 7, delta: { partial_json: "{}" } }),
    ).toBeUndefined();
    expect(accumulator.finish().toolCalls).toEqual([]);
  });

  it("synthesises an id and name for an unnamed tool block", () => {
    const accumulator = new AnthropicStreamAccumulator();
    accumulator.push({
      type: "content_block_start",
      index: 2,
      content_block: { type: "tool_use" },
    });
    // A block that never received partial JSON keeps its unparseable input visible.
    expect(accumulator.finish().toolCalls).toEqual([
      { id: "toolu_2", name: "", arguments: { raw: "" } },
    ]);
  });

  it("defaults a missing index to zero", () => {
    const accumulator = new AnthropicStreamAccumulator();
    accumulator.push({
      type: "content_block_start",
      content_block: { type: "tool_use", id: "toolu_z", name: "noindex" },
    });
    accumulator.push({ type: "content_block_delta", delta: { partial_json: '{"a":1}' } });
    expect(accumulator.finish().toolCalls).toEqual([
      { id: "toolu_z", name: "noindex", arguments: { a: 1 } },
    ]);
  });

  it("orders tool calls by block index regardless of arrival order", () => {
    const accumulator = new AnthropicStreamAccumulator();
    accumulator.push({
      type: "content_block_start",
      index: 1,
      content_block: { type: "tool_use", id: "b", name: "second" },
    });
    accumulator.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "a", name: "first" },
    });
    expect(accumulator.finish().toolCalls.map((call) => call.id)).toEqual(["a", "b"]);
  });

  it("merges usage reported across separate frames", () => {
    const accumulator = new AnthropicStreamAccumulator();
    accumulator.push({ type: "message_start", message: { usage: { input_tokens: 11 } } });
    accumulator.push({ type: "message_delta", delta: {}, usage: { output_tokens: 4 } });
    expect(accumulator.finish().usage).toEqual({ prompt: 11, completion: 4, total: 15 });
  });
});
