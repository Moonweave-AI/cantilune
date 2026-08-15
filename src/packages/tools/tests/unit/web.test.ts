import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWebExecutor } from "../../src/web/webExecutor.js";
import { htmlToText, webFetch } from "../../src/web/webFetch.js";
import { formatSearchResults, webSearch } from "../../src/web/webSearch.js";

function mockFetchResponse(options: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  body?: string;
  useStream?: boolean;
  chunks?: string[];
}): Response {
  const bodyText = options.body ?? "";
  const chunks = options.chunks ?? (bodyText ? [bodyText] : []);

  let chunkIndex = 0;
  const reader = {
    read: vi.fn(async () => {
      if (chunkIndex >= chunks.length) {
        return { done: true, value: undefined };
      }
      const value = new TextEncoder().encode(chunks[chunkIndex] ?? "");
      chunkIndex++;
      return { done: false, value };
    }),
    releaseLock: vi.fn(),
  };

  // Only the members webFetch/webSearch touch are stubbed, so the shape cannot
  // structurally satisfy the full Response interface.
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? (options.contentType ?? "text/plain") : null,
    },
    text: vi.fn(async () => bodyText),
    body: options.useStream ? { getReader: () => reader } : null,
    json: vi.fn(async () => JSON.parse(bodyText)),
  } as unknown as Response;
}

describe("webFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches plain text and respects maxLength truncation", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "text/plain",
        body: "abcdefghij",
        useStream: true,
        chunks: ["abc", "def", "ghij"],
      }),
    );

    const output = await webFetch(
      { url: "https://example.com/doc", maxLength: 5 },
      { enabled: true },
    );
    expect(output).toBe("abcde\n...(truncated)");
  });

  it("converts HTML to plain text with paragraph structure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "text/html",
        body: "<html><script>x</script><style>y</style><p>Hello &amp; world</p><p>Second paragraph</p></html>",
      }),
    );

    const output = await webFetch({ url: "https://example.com" }, { enabled: true });
    expect(output).toContain("Hello & world");
    expect(output).toContain("Second paragraph");
  });

  it("rejects unsupported content types", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({ contentType: "application/json", body: '{"a":1}' }),
    );

    await expect(
      webFetch({ url: "https://example.com/data.json" }, { enabled: true }),
    ).rejects.toThrow("Unsupported content type");
  });

  it("uses response.text when body reader is unavailable", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "text/plain",
        body: "fallback text",
        useStream: false,
      }),
    );

    const output = await webFetch({ url: "https://example.com/plain" }, { enabled: true });
    expect(output).toBe("fallback text");
  });

  it("throws on non-ok HTTP status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({ ok: false, status: 404, body: "missing" }),
    );

    await expect(
      webFetch({ url: "https://example.com/missing" }, { enabled: true }),
    ).rejects.toThrow("HTTP 404");
  });

  it("aborts on timeout using configured timeoutMs", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });

    const pending = webFetch(
      { url: "https://example.com/slow" },
      { enabled: true, timeoutMs: 100 },
    );
    vi.advanceTimersByTime(100);
    await expect(pending).rejects.toThrow("aborted");
  });
});

describe("htmlToText", () => {
  it("strips tags, decodes entities, and preserves paragraphs", () => {
    const text = htmlToText("<p>One &amp; two</p><br><p>Three &#39; four</p>");
    expect(text).toContain("One & two");
    expect(text).toContain("Three ' four");
  });
});

describe("formatSearchResults", () => {
  it("formats search results as numbered list", () => {
    const output = formatSearchResults([
      { title: "Example", url: "https://example.com", snippet: "An example site" },
      { title: "Other", url: "https://other.com", snippet: "Another site" },
    ]);
    expect(output).toContain("1. Example");
    expect(output).toContain("https://example.com");
    expect(output).toContain("An example site");
    expect(output).toContain("2. Other");
  });
});

describe("webSearch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns not configured message when provider is none", async () => {
    const output = await webSearch({ query: "test" }, { provider: "none" });
    expect(output).toBe("Web search not configured. Set search API key in config.");
  });

  it("returns not configured message when api key is missing", async () => {
    const output = await webSearch({ query: "test" }, { provider: "tavily" });
    expect(output).toBe("Web search not configured. Set search API key in config.");
  });

  it("parses Tavily API results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { title: "Tavily Result", url: "https://tavily.example", content: "Snippet text" },
          ],
        }),
      }),
    );

    const output = await webSearch(
      { query: "example query", maxResults: 1 },
      { provider: "tavily", apiKey: "test-key" },
    );
    expect(output).toContain("1. Tavily Result");
    expect(output).toContain("https://tavily.example");
    expect(output).toContain("Snippet text");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("parses Serper API results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "application/json",
        body: JSON.stringify({
          organic: [
            { title: "Serper Hit", link: "https://serper.example", snippet: "From Google" },
          ],
        }),
      }),
    );

    const output = await webSearch(
      { query: "serper query" },
      { provider: "serper", apiKey: "serper-key" },
    );
    expect(output).toContain("Serper Hit");
    expect(output).toContain("https://serper.example");
  });

  it("parses Brave API results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "application/json",
        body: JSON.stringify({
          web: {
            results: [
              { title: "Brave Hit", url: "https://brave.example", description: "Brave snippet" },
            ],
          },
        }),
      }),
    );

    const output = await webSearch(
      { query: "brave query" },
      { provider: "brave", apiKey: "brave-key" },
    );
    expect(output).toContain("Brave Hit");
    expect(output).toContain("https://brave.example");
    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0];
    expect(calledUrl).toBeInstanceOf(URL);
    expect((calledUrl as URL).href).toContain("https://api.search.brave.com/res/v1/web/search");
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
  });

  it("returns failure message on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse({ ok: false, status: 503 }));

    const output = await webSearch({ query: "fail query" }, { provider: "tavily", apiKey: "key" });
    expect(output).toContain("Web search failed");
    expect(output).toContain("503");
  });

  it("returns failure message for Serper HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse({ ok: false, status: 401 }));

    const output = await webSearch({ query: "serper fail" }, { provider: "serper", apiKey: "key" });
    expect(output).toContain("Serper search failed");
    expect(output).toContain("401");
  });

  it("returns failure message for Brave HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse({ ok: false, status: 429 }));

    const output = await webSearch({ query: "brave fail" }, { provider: "brave", apiKey: "key" });
    expect(output).toContain("Brave search failed");
    expect(output).toContain("429");
  });

  it("returns failure message on fetch rejection", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const output = await webSearch({ query: "error query" }, { provider: "tavily", apiKey: "key" });
    expect(output).toContain("Web search failed");
    expect(output).toContain("network down");
  });

  it("returns no results message when API returns empty list", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "application/json",
        body: JSON.stringify({ results: [] }),
      }),
    );

    const output = await webSearch({ query: "empty" }, { provider: "tavily", apiKey: "key" });
    expect(output).toContain('No results found for query: "empty"');
  });

  it("handles non-Error fetch rejection", async () => {
    vi.mocked(fetch).mockRejectedValue("offline");

    const output = await webSearch(
      { query: "string error" },
      { provider: "serper", apiKey: "key" },
    );
    expect(output).toContain("offline");
  });

  it("fills missing fields from API responses", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "application/json",
        body: JSON.stringify({
          organic: [{}],
        }),
      }),
    );

    const output = await webSearch({ query: "sparse" }, { provider: "serper", apiKey: "key" });
    expect(output).toContain("1. ");
  });
});

describe("createWebExecutor", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists web tool schemas", async () => {
    const executor = createWebExecutor({ enabled: true });
    const tools = await executor.listTools();
    expect(tools.map((t) => t.name)).toEqual(["web_search", "web_fetch"]);
  });

  it("executes web_search with configured provider", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ title: "Hit", url: "https://hit.example", content: "snippet" }],
        }),
      }),
    );
    const executor = createWebExecutor({
      enabled: true,
      searchProvider: "tavily",
      searchApiKey: "key",
    });
    const result = await executor.execute("web_search", { query: "cats", maxResults: 3 });
    expect(result.ok).toBe(true);
    expect(result.output).toContain("Hit");
  });

  it("executes web_fetch with optional maxLength", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({ contentType: "text/plain", body: "content" }),
    );
    const executor = createWebExecutor({ enabled: true });
    const result = await executor.execute("web_fetch", {
      url: "https://example.com",
      maxLength: 100,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toBe("content");
  });

  it("rejects unknown web tool", async () => {
    const executor = createWebExecutor({ enabled: true });
    const result = await executor.execute("web_unknown", {});
    expect(result.ok).toBe(false);
    expect(result.output).toContain("Unknown web tool");
  });

  it("validates argument types", async () => {
    const executor = createWebExecutor({ enabled: true });
    const badQuery = await executor.execute("web_search", { query: 123 });
    expect(badQuery.ok).toBe(false);
    expect(badQuery.output).toContain("Expected string argument: query");
  });
});
