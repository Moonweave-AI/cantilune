import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleAdapter } from "../../src/google/googleAdapter.js";
import { requestBodyText } from "../support/requestBody.js";

const entry = {
  slug: "google",
  tier: "native" as const,
  defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  envKeyName: "GOOGLE_API_KEY",
};

describe("createGoogleAdapter", () => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...envSnapshot };
  });

  it("posts generateContent and returns parsed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Gemini reply" }] },
              finishReason: "STOP",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createGoogleAdapter(
      {
        provider: "google",
        model: "gemini-2.0-flash",
        apiKey: () => "google-key",
        maxTokens: 512,
        temperature: 0.2,
      },
      entry,
      { headers: { "x-trace": "1" }, timeout: 10_000, retries: 0 },
    );

    const response = await adapter.chat({
      messages: [{ role: "user", content: "Hello" }],
      tools: [
        {
          name: "search",
          description: "Search",
          parameters: { type: "object", properties: {} },
        },
      ],
    });

    expect(response).toEqual({
      text: "Gemini reply",
      toolCalls: [],
      finishReason: "stop",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-2.0-flash:generateContent");
    expect(url).toContain("key=google-key");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", "x-trace": "1" });

    const body = JSON.parse(requestBodyText(init.body)) as {
      tools: unknown;
      generationConfig: unknown;
    };
    expect(body.tools).toBeDefined();
    expect(body.generationConfig).toEqual({ maxOutputTokens: 512, temperature: 0.2 });
  });

  it("resolves API key from environment when config omits it", async () => {
    process.env.GOOGLE_API_KEY = "env-google-key";
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
        }),
        { status: 200 },
      ),
    );

    const adapter = createGoogleAdapter({ provider: "google", model: "gemini-pro" }, entry, {
      retries: 0,
    });

    await adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] });

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("key=env-google-key");
  });

  it("normalizes trailing slashes in baseUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createGoogleAdapter(
      {
        provider: "google",
        model: "gemini-pro",
        baseUrl: "https://custom.google.endpoint/v1beta///",
        apiKey: () => "key",
      },
      entry,
      { retries: 0 },
    );

    await adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      "https://custom.google.endpoint/v1beta/models/gemini-pro:generateContent?key=key",
    );
  });

  it("throws when API key is missing", async () => {
    const adapter = createGoogleAdapter({ provider: "google", model: "gemini-pro" }, entry);

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("Google API key is required");
  });

  it("throws on non-ok API responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Invalid API key", { status: 400 }));

    const adapter = createGoogleAdapter(
      { provider: "google", model: "gemini-pro", apiKey: () => "bad" },
      entry,
      { retries: 0 },
    );

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("Google Gemini API error (400): Invalid API key");
  });

  it("omits tools and generationConfig when not needed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;

    const adapter = createGoogleAdapter(
      { provider: "google", model: "gemini-pro", apiKey: () => "key" },
      entry,
      { retries: 0 },
    );

    await adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] });

    const body = JSON.parse(
      requestBodyText((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    );
    expect(body.tools).toBeUndefined();
    expect(body.generationConfig).toBeUndefined();
  });
});
