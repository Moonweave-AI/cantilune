import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbedder } from "../../src/index.js";
import { createOpenAiEmbedder } from "../../src/openaiCompatible/openAiEmbeddingsAdapter.js";
import { requestBodyText } from "../support/requestBody.js";

const openaiEntry = {
  slug: "openai",
  tier: "openai-compatible" as const,
  defaultBaseUrl: "https://api.openai.com/v1",
  envKeyName: "OPENAI_API_KEY",
};

function embeddingResponse(vectors: readonly number[][]): Response {
  return new Response(
    JSON.stringify({
      data: vectors.map((embedding) => ({ embedding })),
      model: "text-embedding-3-small",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("createOpenAiEmbedder", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to /embeddings and returns vectors in request order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      embeddingResponse([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]),
    );
    globalThis.fetch = fetchMock;

    const embedder = createOpenAiEmbedder(
      { provider: "openai", model: "text-embedding-3-small", apiKey: () => "test-key" },
      openaiEntry,
    );

    const vectors = await embedder.embed(["goal one", "evidence two"]);

    expect(vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(requestBodyText(init.body)) as { model: string; input: string[] };
    expect(body.model).toBe("text-embedding-3-small");
    expect(body.input).toEqual(["goal one", "evidence two"]);
  });

  it("reports 0 dimensions until the first call, then the real dimensionality", async () => {
    const fetchMock = vi.fn().mockResolvedValue(embeddingResponse([[0.1, 0.2, 0.3, 0.4]]));
    globalThis.fetch = fetchMock;

    const embedder = createOpenAiEmbedder(
      { provider: "openai", model: "text-embedding-3-small", apiKey: () => "k" },
      openaiEntry,
    );

    expect(embedder.dimensions).toBe(0);
    await embedder.embed(["only one"]);
    expect(embedder.dimensions).toBe(4);
  });

  it("returns an empty array for empty input without a network call", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const embedder = createOpenAiEmbedder(
      { provider: "openai", model: "text-embedding-3-small", apiKey: () => "k" },
      openaiEntry,
    );

    const vectors = await embedder.embed([]);
    expect(vectors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "bad model" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const embedder = createOpenAiEmbedder(
      { provider: "openai", model: "no-such-model", apiKey: () => "k" },
      openaiEntry,
      { retries: 0 },
    );

    await expect(embedder.embed(["x"])).rejects.toThrow(
      /OpenAI-compatible embeddings error \(400\)/,
    );
  });

  it("throws when the response omits a vector", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0.1] }, {}] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const embedder = createOpenAiEmbedder(
      { provider: "openai", model: "text-embedding-3-small", apiKey: () => "k" },
      openaiEntry,
      { retries: 0 },
    );

    await expect(embedder.embed(["a", "b"])).rejects.toThrow(/omitted an embedding vector/);
  });

  it("throws when the response count does not match the request count", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ embedding: [0.1] }, { embedding: [0.2] }, { embedding: [0.3] }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const embedder = createOpenAiEmbedder(
      { provider: "openai", model: "text-embedding-3-small", apiKey: () => "k" },
      openaiEntry,
      { retries: 0 },
    );

    await expect(embedder.embed(["a", "b"])).rejects.toThrow(/3 vectors for 2 inputs/);
  });

  it("uses a baseUrl override and strips its trailing slash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(embeddingResponse([[0.1]]));
    globalThis.fetch = fetchMock;

    const embedder = createOpenAiEmbedder(
      {
        provider: "ollama",
        model: "nomic-embed-text",
        baseUrl: "http://localhost:11434/v1/",
      },
      {
        slug: "ollama",
        tier: "openai-compatible",
        defaultBaseUrl: "http://localhost:11434/v1",
        envKeyName: "",
      },
      { retries: 0 },
    );

    await embedder.embed(["x"]);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/embeddings");
  });
});

describe("createEmbedder factory", () => {
  it("returns an embedder for an openai-compatible provider", () => {
    const embedder = createEmbedder({ provider: "openai", model: "text-embedding-3-small" });
    expect(embedder).toBeDefined();
    expect(embedder?.dimensions).toBe(0);
  });

  it("returns undefined for a native provider with no embeddings surface (anthropic)", () => {
    // Native providers have no uniform /embeddings surface; the caller must fall
    // back to keyword matching rather than receive a broken embedder.
    const embedder = createEmbedder({ provider: "anthropic", model: "claude-sonnet-4" });
    expect(embedder).toBeUndefined();
  });

  it("returns undefined for a native provider with no embeddings surface (google)", () => {
    const embedder = createEmbedder({ provider: "google", model: "gemini-2.5-pro" });
    expect(embedder).toBeUndefined();
  });

  it("returns an embedder for an unknown provider with an explicit baseUrl", () => {
    const embedder = createEmbedder({
      provider: "custom-embeddings",
      model: "embed-v1",
      baseUrl: "https://embed.example.com/v1",
    });
    expect(embedder).toBeDefined();
  });

  it("returns undefined for an unknown provider with no baseUrl", () => {
    const embedder = createEmbedder({ provider: "mystery", model: "embed-v1" });
    expect(embedder).toBeUndefined();
  });
});
