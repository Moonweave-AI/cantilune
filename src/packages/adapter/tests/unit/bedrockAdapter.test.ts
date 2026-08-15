import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBedrockAdapter } from "../../src/bedrock/bedrockAdapter.js";
import { requestBodyText } from "../support/requestBody.js";

const entry = {
  slug: "bedrock",
  tier: "native" as const,
  defaultBaseUrl: "",
  envKeyName: "AWS_ACCESS_KEY_ID",
};

describe("createBedrockAdapter", () => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AWS_ACCESS_KEY_ID = "AKID";
    process.env.AWS_SECRET_ACCESS_KEY = "SECRET";
    delete process.env.AWS_SESSION_TOKEN;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...envSnapshot };
  });

  it("posts signed converse request and returns parsed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { message: { content: [{ text: "Bedrock reply" }] } },
          stopReason: "end_turn",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createBedrockAdapter(
      {
        provider: "bedrock",
        model: "anthropic.claude-3-sonnet",
        apiKey: () => "AKID",
        maxTokens: 1024,
        temperature: 0.5,
      },
      entry,
      { headers: { "x-trace": "1" }, timeout: 10_000, retries: 0 },
    );

    const response = await adapter.chat({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
      tools: [
        {
          name: "lookup",
          description: "Lookup",
          parameters: { type: "object", properties: {} },
        },
      ],
    });

    expect(response).toEqual({
      text: "Bedrock reply",
      toolCalls: [],
      finishReason: "stop",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/model/anthropic.claude-3-sonnet/converse");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256/);
    expect(headers["x-trace"]).toBe("1");

    const body = JSON.parse(requestBodyText(init.body)) as {
      system: unknown;
      inferenceConfig: unknown;
      toolConfig: unknown;
    };
    expect(body.system).toEqual([{ text: "You are helpful." }]);
    expect(body.inferenceConfig).toEqual({ maxTokens: 1024, temperature: 0.5 });
    expect(body.toolConfig).toBeDefined();
  });

  it("uses custom baseUrl override for converse endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { message: { content: [{ text: "custom" }] } },
          stopReason: "end_turn",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createBedrockAdapter(
      {
        provider: "bedrock",
        model: "my-model",
        baseUrl: "https://bedrock-runtime.eu-west-1.amazonaws.com",
        apiKey: () => "AKID",
      },
      entry,
      { retries: 0 },
    );

    await adapter.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [],
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://bedrock-runtime.eu-west-1.amazonaws.com/model/my-model/converse");
  });

  it("throws when AWS credentials are missing", async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const adapter = createBedrockAdapter({ provider: "bedrock", model: "model" }, entry);

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("AWS credentials are required");
  });

  it("throws on non-ok Bedrock API responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Access denied", { status: 403 }));

    const adapter = createBedrockAdapter(
      { provider: "bedrock", model: "model", apiKey: () => "AKID" },
      entry,
      { retries: 0 },
    );

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("AWS Bedrock API error (403): Access denied");
  });

  it("omits optional body fields when not configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { message: { content: [{ text: "ok" }] } },
          stopReason: "end_turn",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createBedrockAdapter(
      { provider: "bedrock", model: "model", apiKey: () => "AKID" },
      entry,
      { retries: 0 },
    );

    await adapter.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [],
    });

    const body = JSON.parse(
      requestBodyText((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    );
    expect(body.system).toBeUndefined();
    expect(body.inferenceConfig).toBeUndefined();
    expect(body.toolConfig).toBeUndefined();
  });
});
