import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnthropicAdapter } from "../../src/anthropic/anthropicAdapter.js";
import {
  fromAnthropicResponse,
  splitSystemPrompt,
  toAnthropicMessages,
  toAnthropicTools,
} from "../../src/anthropic/anthropicToolMapping.js";
import { requestBodyText } from "../support/requestBody.js";

const entry = {
  slug: "anthropic",
  tier: "native" as const,
  defaultBaseUrl: "https://api.anthropic.com/v1",
  envKeyName: "ANTHROPIC_API_KEY",
};

describe("anthropicToolMapping", () => {
  it("separates system prompts from conversation messages", () => {
    const split = splitSystemPrompt([
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hello" },
    ]);

    expect(split.system).toBe("Be concise.");
    expect(split.conversation).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("converts tools to Anthropic input_schema format", () => {
    expect(
      toAnthropicTools([
        {
          name: "lookup",
          description: "Lookup data",
          parameters: { type: "object", properties: {} },
        },
      ]),
    ).toEqual([
      {
        name: "lookup",
        description: "Lookup data",
        input_schema: { type: "object", properties: {} },
      },
    ]);
  });

  it("converts assistant tool calls and tool results", () => {
    const messages = toAnthropicMessages([
      {
        role: "assistant",
        content: "Using tool",
        toolCalls: [{ id: "toolu_1", name: "lookup", arguments: '{"id":"42"}' }],
      },
      { role: "tool", toolCallId: "toolu_1", content: "found" },
    ]);

    expect(messages).toEqual([
      {
        role: "assistant",
        content: [
          { type: "text", text: "Using tool" },
          { type: "tool_use", id: "toolu_1", name: "lookup", input: { id: "42" } },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "found" }],
      },
    ]);
  });

  it("parses Anthropic tool_use responses", () => {
    expect(
      fromAnthropicResponse({
        content: [{ type: "tool_use", id: "toolu_1", name: "lookup", input: { id: "42" } }],
        stop_reason: "tool_use",
      }),
    ).toEqual({
      text: undefined,
      toolCalls: [{ id: "toolu_1", name: "lookup", arguments: { id: "42" } }],
      finishReason: "tool_calls",
    });
  });

  it("joins multiple system prompts and skips inline system in messages", () => {
    const split = splitSystemPrompt([
      { role: "system", content: "First" },
      { role: "system", content: "Second" },
      { role: "user", content: "Hi" },
    ]);
    expect(split.system).toBe("First\n\nSecond");
    expect(split.conversation).toHaveLength(1);

    expect(toAnthropicMessages([{ role: "system", content: "ignored" }])).toEqual([]);
  });

  it("handles assistant without text, invalid JSON args, and stop reason mapping", () => {
    expect(
      toAnthropicMessages([
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "t1", name: "x", arguments: "not-json" }],
        },
      ]),
    ).toEqual([
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "t1", name: "x", input: { raw: "not-json" } }],
      },
    ]);

    expect(
      fromAnthropicResponse({
        content: [{ type: "text", text: "done" }],
        stop_reason: "max_tokens",
      }).finishReason,
    ).toBe("length");

    expect(fromAnthropicResponse({ content: [{ type: "text", text: "x" }] }).finishReason).toBe(
      "error",
    );

    expect(
      fromAnthropicResponse({
        content: [{ type: "tool_use", name: "missing-id" }],
      }).toolCalls,
    ).toEqual([]);
  });
});

describe("createAnthropicAdapter", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends system prompt separately from messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Hi there" }],
          stop_reason: "end_turn",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createAnthropicAdapter(
      {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        apiKey: () => "anthropic-key",
      },
      entry,
    );

    const response = await adapter.chat({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
      tools: [],
    });

    expect(response).toEqual({
      text: "Hi there",
      toolCalls: [],
      finishReason: "stop",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestBodyText(init.body)) as {
      system?: string;
      messages: unknown[];
    };

    expect(body.system).toBe("You are helpful.");
    expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
    expect(init.headers).toMatchObject({
      "x-api-key": "anthropic-key",
      "anthropic-version": "2023-06-01",
    });
  });

  it("includes tools, temperature, custom baseUrl, and env-resolved API key", async () => {
    const envSnapshot = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "env-key";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createAnthropicAdapter(
      {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        baseUrl: "https://custom.anthropic.com/v1///",
        temperature: 0.1,
        maxTokens: 100,
      },
      entry,
      { headers: { "x-extra": "1" }, timeout: 5000, retries: 0 },
    );

    await adapter.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [
        { name: "search", description: "Search", parameters: { type: "object", properties: {} } },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://custom.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": "env-key", "x-extra": "1" });

    const body = JSON.parse(requestBodyText(init.body)) as Record<string, unknown>;
    expect(body.tools).toBeDefined();
    expect(body.temperature).toBe(0.1);
    expect(body.max_tokens).toBe(100);

    if (envSnapshot === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = envSnapshot;
    }
  });

  it("throws on non-ok Anthropic API responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Invalid key", { status: 401 }));

    const adapter = createAnthropicAdapter(
      { provider: "anthropic", model: "claude", apiKey: () => "bad" },
      entry,
      { retries: 0 },
    );

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("Anthropic API error (401): Invalid key");
  });

  it("throws when API key is missing", async () => {
    // The adapter falls back to process.env.ANTHROPIC_API_KEY when no apiKey()
    // is configured, so a key present in the environment (local dev shell, CI
    // secret injection) would defeat this test by making resolveApiKey succeed.
    // Isolate the environment: snapshot + delete the var, then restore. Also
    // mock fetch as defense-in-depth so a broken isolation can never reach the
    // network — the assertion is the throw, which fires before any fetch.
    const envSnapshot = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const unreachable = vi.fn();
    globalThis.fetch = unreachable;

    try {
      const adapter = createAnthropicAdapter(
        {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
        entry,
      );

      await expect(
        adapter.chat({
          messages: [{ role: "user", content: "Hello" }],
          tools: [],
        }),
      ).rejects.toThrow("Anthropic API key is required");
      expect(unreachable).not.toHaveBeenCalled();
    } finally {
      if (envSnapshot === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = envSnapshot;
      }
    }
  });
});
