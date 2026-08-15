import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnthropicAdapter } from "../../src/anthropic/anthropicAdapter.js";
import { createBedrockAdapter } from "../../src/bedrock/bedrockAdapter.js";
import { createGoogleAdapter } from "../../src/google/googleAdapter.js";
import { createOpenAiCompatibleAdapter } from "../../src/openaiCompatible/openaiCompatibleAdapter.js";
import type { LlmAdapter } from "@cantilune/boot";

/**
 * Every adapter must let the caller cancel a request.
 *
 * Google and Bedrock accepted the signal and dropped it, so stopping a run left
 * their generations running to completion — invisible except on the bill.
 */
interface Candidate {
  readonly name: string;
  readonly build: () => LlmAdapter;
}

const candidates: readonly Candidate[] = [
  {
    name: "openai-compatible",
    build: () =>
      createOpenAiCompatibleAdapter(
        { provider: "openai", model: "gpt-4o", apiKey: () => "k" },
        {
          slug: "openai",
          tier: "native",
          defaultBaseUrl: "https://api.openai.com/v1",
          envKeyName: "OPENAI_API_KEY",
        },
        { retries: 0 },
      ),
  },
  {
    name: "anthropic",
    build: () =>
      createAnthropicAdapter(
        { provider: "anthropic", model: "claude-3-5-sonnet", apiKey: () => "k" },
        {
          slug: "anthropic",
          tier: "native",
          defaultBaseUrl: "https://api.anthropic.com/v1",
          envKeyName: "ANTHROPIC_API_KEY",
        },
        { retries: 0 },
      ),
  },
  {
    name: "google",
    build: () =>
      createGoogleAdapter(
        { provider: "google", model: "gemini-2.0-flash", apiKey: () => "k" },
        {
          slug: "google",
          tier: "native",
          defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
          envKeyName: "GOOGLE_API_KEY",
        },
        { retries: 0 },
      ),
  },
  {
    name: "bedrock",
    build: () =>
      createBedrockAdapter(
        { provider: "bedrock", model: "anthropic.claude-3-5-sonnet-20240620-v1:0" },
        {
          slug: "bedrock",
          tier: "native",
          defaultBaseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
          envKeyName: "",
        },
        { retries: 0 },
      ),
  },
];

describe("adapters forward caller cancellation to the request", () => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.AWS_REGION = "us-east-1";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...envSnapshot };
  });

  for (const candidate of candidates) {
    it(`${candidate.name} aborts in flight when the caller aborts`, async () => {
      const controller = new AbortController();
      let requestSignal: AbortSignal | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        requestSignal = init.signal ?? undefined;
        return Promise.resolve(
          new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      });

      await candidate
        .build()
        .chat({ messages: [{ role: "user", content: "hi" }], tools: [], signal: controller.signal })
        .catch(() => undefined);

      expect(requestSignal, `${candidate.name} never reached fetch`).toBeDefined();
      expect(requestSignal?.aborted).toBe(false);

      controller.abort();

      expect(requestSignal?.aborted, `${candidate.name} dropped the caller signal`).toBe(true);
    });
  }
});
