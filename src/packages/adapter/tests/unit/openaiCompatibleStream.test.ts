import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmChatRequest, LlmStreamChunk } from "@cantilune/boot";
import { createOpenAiCompatibleAdapter } from "../../src/openaiCompatible/openaiCompatibleAdapter.js";
import {
  StreamAccumulator,
  normalizeToolCallDelta,
} from "../../src/openaiCompatible/openaiToolMapping.js";
import { requestBodyText } from "../support/requestBody.js";

const entry = {
  slug: "openai",
  tier: "openai-compatible" as const,
  defaultBaseUrl: "https://api.openai.com/v1",
  envKeyName: "OPENAI_API_KEY",
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
  const adapter = createOpenAiCompatibleAdapter(
    { provider: "openai", model: "gpt-4o", apiKey: () => "test-key" },
    entry,
    { retries: 0 },
  );
  if (adapter.stream === undefined) {
    throw new Error("openai-compatible adapter must support streaming");
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

describe("createOpenAiCompatibleAdapter.stream", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("requests a stream with usage reporting enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]));
    globalThis.fetch = fetchMock;

    await collect(streamOf(askHi()));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ Accept: "text/event-stream" });

    const body = JSON.parse(requestBodyText(init.body)) as Record<string, unknown>;
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("emits text deltas and a final aggregated response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          { choices: [{ delta: { content: "Hel" } }] },
          { choices: [{ delta: { content: "lo" } }] },
          { choices: [{ delta: {}, finish_reason: "stop" }] },
          { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } },
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
        usage: { prompt: 5, completion: 2, total: 7 },
      },
    });
  });

  it("emits tool-call deltas and reassembles arguments split across frames", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: "call_1", function: { name: "search", arguments: '{"q"' } },
                ],
              },
            },
          ],
        },
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: ':"cantilune"}' } }] } },
          ],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]),
    );

    const chunks = await collect(streamOf(askHi()));

    expect(chunks[0]).toEqual({
      kind: "tool_call_delta",
      index: 0,
      id: "call_1",
      name: "search",
      argumentsDelta: '{"q"',
    });
    expect(chunks[1]).toEqual({
      kind: "tool_call_delta",
      index: 0,
      argumentsDelta: ':"cantilune"}',
    });
    expect(chunks.at(-1)).toEqual({
      kind: "done",
      response: {
        text: undefined,
        toolCalls: [{ id: "call_1", name: "search", arguments: { q: "cantilune" } }],
        finishReason: "tool_calls",
      },
    });
  });

  it("skips malformed frames without killing the stream", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          { choices: [{ delta: { content: "before" } }] },
          "{not json",
          { choices: [{ delta: { content: "after" } }] },
        ]),
      );

    const chunks = await collect(streamOf(askHi()));

    expect(chunks.filter((chunk) => chunk.kind === "text_delta")).toEqual([
      { kind: "text_delta", text: "before" },
      { kind: "text_delta", text: "after" },
    ]);
  });

  it("surfaces an API error before yielding any chunk", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    await expect(collect(streamOf(askHi()))).rejects.toThrow(
      "OpenAI-compatible API error (401): Unauthorized",
    );
  });

  it("still completes when the stream ends without a [DONE] sentinel", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([{ choices: [{ delta: { content: "tail" }, finish_reason: "stop" }] }], {
        done: false,
      }),
    );

    const chunks = await collect(streamOf(askHi()));

    expect(chunks).toEqual([
      { kind: "text_delta", text: "tail" },
      { kind: "done", response: { text: "tail", toolCalls: [], finishReason: "stop" } },
    ]);
  });

  // Provider-drift regression guards. Zhipu/GLM and other OpenAI-compatible
  // endpoints occasionally emit tool-call deltas that deviate from the spec;
  // the adapter must normalize them rather than letting one malformed frame
  // kill the whole stream (the boot layer's strict validator would otherwise
  // throw "LLM stream yielded an invalid tool-call delta").
  it("normalizes a numeric-string tool-call index without breaking the stream", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        {
          choices: [
            {
              delta: {
                // GLM sometimes sends index as the string "0".
                tool_calls: [{ index: "0", id: "call_1", function: { name: "search" } }],
              },
            },
          ],
        },
        {
          choices: [
            { delta: { tool_calls: [{ index: "0", function: { arguments: '{"q":"x"}' } }] } },
          ],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]),
    );

    const chunks = await collect(streamOf(askHi()));
    const toolDeltas = chunks.filter((c) => c.kind === "tool_call_delta");
    expect(toolDeltas[0]).toEqual({
      kind: "tool_call_delta",
      index: 0,
      id: "call_1",
      name: "search",
    });
    expect(toolDeltas[1]).toEqual({
      kind: "tool_call_delta",
      index: 0,
      argumentsDelta: '{"q":"x"}',
    });
    expect(chunks.at(-1)).toEqual({
      kind: "done",
      response: {
        text: undefined,
        toolCalls: [{ id: "call_1", name: "search", arguments: { q: "x" } }],
        finishReason: "tool_calls",
      },
    });
  });

  it("strips a non-string arguments slice rather than throwing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, id: "call_1", function: { name: "search" } }],
              },
            },
          ],
        },
        // A null arguments slice must not propagate as a non-string argumentsDelta.
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: null } }] } }] },
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: '{"q":"y"}' } }] } },
          ],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]),
    );

    const chunks = await collect(streamOf(askHi()));
    const toolDeltas = chunks.filter((c) => c.kind === "tool_call_delta");
    // The null slice yields no argumentsDelta; the following string slice still arrives.
    expect(toolDeltas.find((c) => c.argumentsDelta !== undefined)).toEqual({
      kind: "tool_call_delta",
      index: 0,
      argumentsDelta: '{"q":"y"}',
    });
    expect(chunks.at(-1)).toEqual({
      kind: "done",
      response: {
        text: undefined,
        toolCalls: [{ id: "call_1", name: "search", arguments: { q: "y" } }],
        finishReason: "tool_calls",
      },
    });
  });

  it("drops an unrecoverable frame and keeps accumulating the rest", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        // First frame: index is a non-numeric string — unrecoverable, dropped.
        { choices: [{ delta: { tool_calls: [{ index: "abc", function: { name: "bad" } }] } }] },
        // Second frame: a healthy tool call at index 0.
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "search" } }] } },
          ],
        },
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: '{"q":"z"}' } }] } },
          ],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]),
    );

    const chunks = await collect(streamOf(askHi()));
    const toolDeltas = chunks.filter((c) => c.kind === "tool_call_delta");
    // The "abc" frame was dropped; only the index-0 frames survived.
    expect(toolDeltas.every((c) => c.index === 0)).toBe(true);
    expect(toolDeltas.some((c) => c.name === "search")).toBe(true);
    expect(chunks.at(-1)).toEqual({
      kind: "done",
      response: {
        text: undefined,
        toolCalls: [{ id: "call_1", name: "search", arguments: { q: "z" } }],
        finishReason: "tool_calls",
      },
    });
  });

  it("survives a stream where malformed and healthy frames interleave", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        { choices: [{ delta: { content: "pre" } }] },
        // Malformed tool frame in the middle of text streaming.
        { choices: [{ delta: { tool_calls: [{ index: -1 }] } }] },
        { choices: [{ delta: { content: "post" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]),
    );

    const chunks = await collect(streamOf(askHi()));
    expect(
      chunks.filter((c) => c.kind === "text_delta").map((c) => (c as { text: string }).text),
    ).toEqual(["pre", "post"]);
    expect(chunks.at(-1)).toEqual({
      kind: "done",
      response: { text: "prepost", toolCalls: [], finishReason: "stop" },
    });
  });
});

describe("StreamAccumulator", () => {
  it("ignores frames that carry no choice", () => {
    const accumulator = new StreamAccumulator();
    expect(accumulator.push({ choices: [] })).toBeUndefined();
    expect(accumulator.push({})).toBeUndefined();
    // A stream that never reported a finish reason is treated as failed.
    expect(accumulator.finish()).toEqual({
      text: undefined,
      toolCalls: [],
      finishReason: "error",
    });
  });

  it("ignores empty text deltas", () => {
    const accumulator = new StreamAccumulator();
    expect(accumulator.push({ choices: [{ delta: { content: "" } }] })).toBeUndefined();
    expect(accumulator.push({ choices: [{ delta: {} }] })).toBeUndefined();
    expect(accumulator.finish().text).toBeUndefined();
  });

  it("keeps the first non-null finish reason", () => {
    const accumulator = new StreamAccumulator();
    accumulator.push({ choices: [{ delta: {}, finish_reason: null }] });
    accumulator.push({ choices: [{ delta: {}, finish_reason: "length" }] });
    expect(accumulator.finish().finishReason).toBe("length");
  });

  it("synthesises an id for a tool call the provider never named", () => {
    const accumulator = new StreamAccumulator();
    accumulator.push({
      choices: [{ delta: { tool_calls: [{ index: 3, function: { arguments: "{}" } }] } }],
    });
    expect(accumulator.finish().toolCalls).toEqual([{ id: "call_3", name: "", arguments: {} }]);
  });

  it("orders tool calls by index regardless of arrival order", () => {
    const accumulator = new StreamAccumulator();
    accumulator.push({
      choices: [{ delta: { tool_calls: [{ index: 1, id: "b", function: { name: "second" } }] } }],
    });
    accumulator.push({
      choices: [{ delta: { tool_calls: [{ index: 0, id: "a", function: { name: "first" } }] } }],
    });
    expect(accumulator.finish().toolCalls.map((call) => call.id)).toEqual(["a", "b"]);
  });

  it("derives a total when the provider omits one", () => {
    const accumulator = new StreamAccumulator();
    accumulator.push({ choices: [], usage: { prompt_tokens: 4, completion_tokens: 6 } });
    expect(accumulator.finish().usage).toEqual({ prompt: 4, completion: 6, total: 10 });
  });
});

describe("normalizeToolCallDelta", () => {
  it("passes a well-formed numeric index through unchanged", () => {
    expect(
      normalizeToolCallDelta({ index: 0, id: "call_1", function: { name: "s", arguments: "{}" } }),
    ).toEqual({
      index: 0,
      id: "call_1",
      name: "s",
      argumentsDelta: "{}",
    });
  });

  it("coerces a numeric-string index to a number", () => {
    expect(normalizeToolCallDelta({ index: "0" })).toEqual({ index: 0 });
    expect(normalizeToolCallDelta({ index: "12" })).toEqual({ index: 12 });
  });

  it("returns undefined for a non-numeric or negative index", () => {
    expect(normalizeToolCallDelta({ index: "abc" })).toBeUndefined();
    expect(normalizeToolCallDelta({ index: -1 })).toBeUndefined();
    expect(normalizeToolCallDelta({ index: "-3" })).toBeUndefined();
    expect(normalizeToolCallDelta({ index: 1.5 })).toBeUndefined();
  });

  it("strips a non-string id or name", () => {
    // @ts-expect-error — simulating provider drift where id arrives as a number
    expect(normalizeToolCallDelta({ index: 0, id: 42 })).toEqual({ index: 0 });
    expect(
      // @ts-expect-error — name as a non-string
      normalizeToolCallDelta({ index: 0, function: { name: 42 } }),
    ).toEqual({ index: 0 });
  });

  it("strips a non-string arguments slice and keeps string ones", () => {
    expect(normalizeToolCallDelta({ index: 0, function: { arguments: null } })).toEqual({
      index: 0,
    });
    // Some providers emit `function.arguments` as an object rather than a
    // string; normalizeToolCallDelta strips it at runtime. Cast to the
    // provider delta shape so the test stays type-honest about the input.
    expect(
      normalizeToolCallDelta({
        index: 0,
        function: { arguments: { q: "x" } as unknown as string },
      }),
    ).toEqual({ index: 0 });
    expect(normalizeToolCallDelta({ index: 0, function: { arguments: '{"q":"x"}' } })).toEqual({
      index: 0,
      argumentsDelta: '{"q":"x"}',
    });
  });

  it("omits optional fields entirely when absent", () => {
    expect(normalizeToolCallDelta({ index: 3 })).toEqual({ index: 3 });
  });
});
