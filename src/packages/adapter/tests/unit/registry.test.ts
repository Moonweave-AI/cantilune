import { describe, expect, it, vi } from "vitest";
import { createAdapter, getProvider, listProviders } from "../../src/registry.js";

describe("registry", () => {
  it("returns known providers by slug", () => {
    expect(getProvider("openai")?.defaultBaseUrl).toBe("https://api.openai.com/v1");
    expect(getProvider("anthropic")?.tier).toBe("native");
    expect(getProvider("GOOGLE")?.slug).toBe("google");
    expect(getProvider("unknown")).toBeUndefined();
  });

  it("lists all registered providers", () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(20);
    expect(providers.some((entry) => entry.slug === "groq")).toBe(true);
    expect(providers.some((entry) => entry.slug === "bedrock")).toBe(true);
  });

  it("routes openai-compatible providers to OpenAI adapter", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        }),
        { status: 200 },
      ),
    );

    try {
      const adapter = createAdapter({
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        apiKey: () => "groq-key",
      });

      const response = await adapter.chat({
        messages: [{ role: "user", content: "ping" }],
        tools: [],
      });

      expect(response.text).toBe("ok");
      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("routes native anthropic provider", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "anthropic" }],
          stop_reason: "end_turn",
        }),
        { status: 200 },
      ),
    );

    try {
      const adapter = createAdapter({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        apiKey: () => "key",
      });

      const response = await adapter.chat({
        messages: [{ role: "user", content: "hi" }],
        tools: [],
      });

      expect(response.text).toBe("anthropic");
      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to openai-compatible when baseUrl is provided for unknown provider", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "custom" }, finish_reason: "stop" }],
        }),
        { status: 200 },
      ),
    );

    try {
      const adapter = createAdapter({
        provider: "custom-local",
        model: "my-model",
        baseUrl: "http://localhost:8080/v1",
        apiKey: () => "local",
      });

      const response = await adapter.chat({
        messages: [{ role: "user", content: "hi" }],
        tools: [],
      });

      expect(response.text).toBe("custom");
      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toBe("http://localhost:8080/v1/chat/completions");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws for unknown provider without baseUrl", () => {
    expect(() =>
      createAdapter({
        provider: "totally-unknown",
        model: "x",
      }),
    ).toThrow('Unknown provider "totally-unknown"');
  });
});
