import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAiCompatibleAdapter } from "../../src/openaiCompatible/openaiCompatibleAdapter.js";
import {
  fromOpenAiResponse,
  decodeOpenAiToolName,
  encodeOpenAiToolName,
  toOpenAiMessages,
  toOpenAiTools,
  type OpenAiChoice,
} from "../../src/openaiCompatible/openaiToolMapping.js";
import { requestBodyText } from "../support/requestBody.js";

const entry = {
  slug: "openai",
  tier: "openai-compatible" as const,
  defaultBaseUrl: "https://api.openai.com/v1",
  envKeyName: "OPENAI_API_KEY",
};

describe("openaiToolMapping", () => {
  it("converts tool definitions to OpenAI function format", () => {
    const tools = toOpenAiTools([
      {
        name: "search",
        description: "Search the web",
        parameters: { type: "object", properties: { q: { type: "string" } } },
      },
    ]);

    expect(tools).toEqual([
      {
        type: "function",
        function: {
          name: "search",
          description: "Search the web",
          parameters: { type: "object", properties: { q: { type: "string" } } },
        },
      },
    ]);
  });

  it("encodes Cantilune external tool names and decodes provider responses", () => {
    const internalName = "tool:shell_run_command";
    const encoded = encodeOpenAiToolName(internalName);
    expect(encoded).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(encoded).not.toBe(internalName);
    expect(decodeOpenAiToolName(encoded)).toBe(internalName);

    expect(
      toOpenAiTools([
        { name: internalName, description: "Run a command", parameters: { type: "object" } },
      ])[0]?.function.name,
    ).toBe(encoded);
    expect(
      fromOpenAiResponse({
        message: {
          tool_calls: [
            { id: "call_1", type: "function", function: { name: encoded, arguments: "{}" } },
          ],
        },
        finish_reason: "tool_calls",
      }).toolCalls[0]?.name,
    ).toBe(internalName);
  });

  it("converts LLM messages to OpenAI chat format", () => {
    const messages = toOpenAiMessages([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: "Calling tool",
        toolCalls: [{ id: "call_1", name: "search", arguments: '{"q":"test"}' }],
      },
      { role: "tool", toolCallId: "call_1", content: "result" },
    ]);

    expect(messages).toEqual([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: "Calling tool",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "search", arguments: '{"q":"test"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "result" },
    ]);
  });

  it("parses OpenAI tool call responses", () => {
    const choice: OpenAiChoice = {
      message: {
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "search", arguments: '{"q":"hello"}' },
          },
        ],
      },
      finish_reason: "tool_calls",
    };

    expect(fromOpenAiResponse(choice)).toEqual({
      text: undefined,
      toolCalls: [{ id: "call_1", name: "search", arguments: { q: "hello" } }],
      finishReason: "tool_calls",
    });
  });

  it("parses text-only OpenAI responses", () => {
    const choice: OpenAiChoice = {
      message: { content: "Done." },
      finish_reason: "stop",
    };

    expect(fromOpenAiResponse(choice)).toEqual({
      text: "Done.",
      toolCalls: [],
      finishReason: "stop",
    });
  });

  it("handles invalid tool arguments and unknown finish reasons", () => {
    const choice: OpenAiChoice = {
      message: {
        tool_calls: [
          {
            id: "call_2",
            type: "function",
            function: { name: "act", arguments: "not-json" },
          },
        ],
      },
      finish_reason: "tool_calls",
    };

    expect(fromOpenAiResponse(choice).toolCalls[0]?.arguments).toEqual({ raw: "not-json" });
    expect(fromOpenAiResponse(undefined).finishReason).toBe("error");
    expect(
      fromOpenAiResponse({ message: { content: "x" }, finish_reason: "unknown" }).finishReason,
    ).toBe("error");
  });

  it("maps length finish reason", () => {
    expect(
      fromOpenAiResponse({ message: { content: "cut" }, finish_reason: "length" }).finishReason,
    ).toBe("length");
  });
});

describe("createOpenAiCompatibleAdapter", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts chat completions and returns parsed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: "Hello back" },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createOpenAiCompatibleAdapter(
      {
        provider: "openai",
        model: "gpt-4o",
        apiKey: () => "test-key",
      },
      entry,
    );

    const response = await adapter.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [],
    });

    expect(response).toEqual({
      text: "Hello back",
      toolCalls: [],
      finishReason: "stop",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
  });

  it("works without API key and resolves key from environment", async () => {
    const envSnapshot = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "env-openai";

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        ),
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createOpenAiCompatibleAdapter(
      {
        provider: "ollama",
        model: "llama",
        baseUrl: "http://localhost:11434/v1",
      },
      {
        slug: "ollama",
        tier: "openai-compatible",
        defaultBaseUrl: "http://localhost:11434/v1",
        envKeyName: "",
      },
      { retries: 0 },
    );

    await adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] });
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).not.toHaveProperty(
      "Authorization",
    );

    const keyedAdapter = createOpenAiCompatibleAdapter(
      { provider: "openai", model: "gpt-4o" },
      entry,
      { retries: 0 },
    );
    await keyedAdapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] });
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers).toMatchObject({
      Authorization: "Bearer env-openai",
    });

    if (envSnapshot === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = envSnapshot;
    }
  });

  it("includes tools, temperature, maxTokens, and custom headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createOpenAiCompatibleAdapter(
      {
        provider: "openai",
        model: "gpt-4o",
        apiKey: () => "key",
        maxTokens: 256,
        temperature: 0.7,
        baseUrl: "https://api.openai.com/v1///",
      },
      entry,
      { headers: { "x-org": "test" }, timeout: 3000, retries: 0 },
    );

    await adapter.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [
        { name: "search", description: "Search", parameters: { type: "object", properties: {} } },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ "x-org": "test" });

    const body = JSON.parse(requestBodyText(init.body)) as Record<string, unknown>;
    expect(body.tools).toBeDefined();
    expect(body.max_tokens).toBe(256);
    expect(body.temperature).toBe(0.7);
  });

  it("throws on non-retryable API errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    const adapter = createOpenAiCompatibleAdapter(
      {
        provider: "openai",
        model: "gpt-4o",
        apiKey: () => "bad-key",
      },
      entry,
      { retries: 0 },
    );

    await expect(
      adapter.chat({
        messages: [{ role: "user", content: "Hi" }],
        tools: [],
      }),
    ).rejects.toThrow("OpenAI-compatible API error (401): Unauthorized");
  });

  it("retries on retryable server errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Server error", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Recovered" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;

    const adapter = createOpenAiCompatibleAdapter(
      {
        provider: "openai",
        model: "gpt-4o",
        apiKey: () => "test-key",
      },
      entry,
      { retries: 1, timeout: 5_000 },
    );

    const response = await adapter.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [],
    });

    expect(response.text).toBe("Recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("builds Azure deployments URL with api-version and api-key header", async () => {
    const previousVersion = process.env.AZURE_OPENAI_API_VERSION;
    process.env.AZURE_OPENAI_API_VERSION = "2024-10-21";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "azure-ok" }, finish_reason: "stop" }],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createOpenAiCompatibleAdapter(
      {
        provider: "azure",
        model: "gpt-4o",
        apiKey: () => "azure-key",
        baseUrl: "https://myres.openai.azure.com",
      },
      {
        slug: "azure",
        tier: "openai-compatible",
        defaultBaseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
        envKeyName: "AZURE_OPENAI_API_KEY",
      },
      { retries: 0 },
    );

    await adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://myres.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21",
    );
    expect(url).not.toContain("{resource}");
    expect(init.headers).toMatchObject({
      "api-key": "azure-key",
    });
    expect(init.headers).not.toHaveProperty("Authorization");

    if (previousVersion === undefined) {
      delete process.env.AZURE_OPENAI_API_VERSION;
    } else {
      process.env.AZURE_OPENAI_API_VERSION = previousVersion;
    }
  });

  it("fail-closes Azure when baseUrl still has placeholders or api-version is missing", async () => {
    const previousVersion = process.env.AZURE_OPENAI_API_VERSION;
    const previousOpenAi = process.env.OPENAI_API_VERSION;
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.OPENAI_API_VERSION;

    const azureEntry = {
      slug: "azure",
      tier: "openai-compatible" as const,
      defaultBaseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
      envKeyName: "AZURE_OPENAI_API_KEY",
    };

    const missingVersion = createOpenAiCompatibleAdapter(
      {
        provider: "azure",
        model: "gpt-4o",
        apiKey: () => "azure-key",
        baseUrl: "https://myres.openai.azure.com",
      },
      azureEntry,
      { retries: 0 },
    );
    await expect(
      missingVersion.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("AZURE_OPENAI_API_VERSION");

    process.env.AZURE_OPENAI_API_VERSION = "2024-10-21";
    const placeholder = createOpenAiCompatibleAdapter(
      {
        provider: "azure",
        model: "gpt-4o",
        apiKey: () => "azure-key",
      },
      azureEntry,
      { retries: 0 },
    );
    await expect(
      placeholder.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("placeholders are not callable");

    if (previousVersion === undefined) {
      delete process.env.AZURE_OPENAI_API_VERSION;
    } else {
      process.env.AZURE_OPENAI_API_VERSION = previousVersion;
    }
    if (previousOpenAi === undefined) {
      delete process.env.OPENAI_API_VERSION;
    } else {
      process.env.OPENAI_API_VERSION = previousOpenAi;
    }
  });
});
