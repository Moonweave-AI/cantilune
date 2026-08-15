import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdapter } from "../../src/registry.js";

describe("adapter integration — native provider routing", () => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...envSnapshot };
  });

  it("routes google provider through Gemini generateContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "gemini" }] }, finishReason: "STOP" }],
        }),
        { status: 200 },
      ),
    );

    const adapter = createAdapter({
      provider: "google",
      model: "gemini-2.0-flash",
      apiKey: () => "google-key",
    });

    const response = await adapter.chat({
      messages: [{ role: "user", content: "ping" }],
      tools: [],
    });

    expect(response.text).toBe("gemini");
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain(":generateContent");
  });

  it("routes bedrock provider through signed converse endpoint", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKID";
    process.env.AWS_SECRET_ACCESS_KEY = "SECRET";

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { message: { content: [{ text: "bedrock" }] } },
          stopReason: "end_turn",
        }),
        { status: 200 },
      ),
    );

    const adapter = createAdapter({
      provider: "bedrock",
      model: "anthropic.claude-3-sonnet",
      apiKey: () => "AKID",
    });

    const response = await adapter.chat({
      messages: [{ role: "user", content: "ping" }],
      tools: [],
    });

    expect(response.text).toBe("bedrock");
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("bedrock-runtime");
    expect(url).toContain("/converse");
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^AWS4-HMAC-SHA256/);
  });
});
