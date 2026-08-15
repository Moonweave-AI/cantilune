import { describe, expect, it, vi } from "vitest";
import { createAdapter } from "../../src/registry.js";

describe("adapter contract — rejection scenarios", () => {
  it("rejects unknown provider without baseUrl", () => {
    expect(() =>
      createAdapter({
        provider: "nonexistent-vendor",
        model: "x",
      }),
    ).toThrow('Unknown provider "nonexistent-vendor"');
  });

  it("rejects Anthropic chat when API key is absent", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const adapter = createAdapter({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("Anthropic API key is required");

    if (originalKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("rejects Google chat when API key is absent", async () => {
    const originalKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const adapter = createAdapter({
      provider: "google",
      model: "gemini-pro",
    });

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("Google API key is required");

    if (originalKey !== undefined) {
      process.env.GOOGLE_API_KEY = originalKey;
    }
  });

  it("rejects Bedrock chat when AWS credentials are absent", async () => {
    const originalAccess = process.env.AWS_ACCESS_KEY_ID;
    const originalSecret = process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const adapter = createAdapter({
      provider: "bedrock",
      model: "anthropic.claude-3-sonnet",
    });

    await expect(
      adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
    ).rejects.toThrow("AWS credentials are required");

    if (originalAccess !== undefined) {
      process.env.AWS_ACCESS_KEY_ID = originalAccess;
    }
    if (originalSecret !== undefined) {
      process.env.AWS_SECRET_ACCESS_KEY = originalSecret;
    }
  });

  it("surfaces HTTP error bodies from provider APIs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("quota exceeded", { status: 429 }));

    try {
      const adapter = createAdapter(
        { provider: "openai", model: "gpt-4o", apiKey: () => "key" },
        { retries: 0 },
      );

      await expect(
        adapter.chat({ messages: [{ role: "user", content: "Hi" }], tools: [] }),
      ).rejects.toThrow("OpenAI-compatible API error (429): quota exceeded");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
