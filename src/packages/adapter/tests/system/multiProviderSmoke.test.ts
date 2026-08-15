import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdapter } from "../../src/registry.js";

describe("adapter system — multi-provider smoke", () => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...envSnapshot };
  });

  it("supports tool-call round-trip shapes across OpenAI, Anthropic, Google, and Bedrock", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: { name: "search", arguments: '{"q":"a"}' },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: "tool_use", id: "toolu_1", name: "search", input: { q: "b" } }],
            stop_reason: "tool_use",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ functionCall: { name: "search", args: { q: "c" } } }] },
                finishReason: "STOP",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: {
              message: {
                content: [{ toolUse: { toolUseId: "tu_1", name: "search", input: { q: "d" } } }],
              },
            },
            stopReason: "tool_use",
          }),
          { status: 200 },
        ),
      );

    globalThis.fetch = fetchMock;
    process.env.AWS_ACCESS_KEY_ID = "AKID";
    process.env.AWS_SECRET_ACCESS_KEY = "SECRET";

    const toolDef = {
      name: "search",
      description: "Search",
      parameters: { type: "object", properties: { q: { type: "string" } } },
    };

    const openAi = createAdapter(
      { provider: "openai", model: "gpt-4o", apiKey: () => "k" },
      { retries: 0 },
    );
    const anthropic = createAdapter(
      { provider: "anthropic", model: "claude", apiKey: () => "k" },
      { retries: 0 },
    );
    const google = createAdapter(
      { provider: "google", model: "gemini-pro", apiKey: () => "k" },
      { retries: 0 },
    );
    const bedrock = createAdapter(
      { provider: "bedrock", model: "model", apiKey: () => "AKID" },
      { retries: 0 },
    );

    const request = {
      messages: [{ role: "user" as const, content: "find something" }],
      tools: [toolDef],
    };

    const [openAiResult, anthropicResult, googleResult, bedrockResult] = await Promise.all([
      openAi.chat(request),
      anthropic.chat(request),
      google.chat(request),
      bedrock.chat(request),
    ]);

    expect(openAiResult.finishReason).toBe("tool_calls");
    expect(anthropicResult.finishReason).toBe("tool_calls");
    expect(googleResult.finishReason).toBe("tool_calls");
    expect(bedrockResult.finishReason).toBe("tool_calls");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
