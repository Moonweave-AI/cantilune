export interface WebSearchConfig {
  readonly provider: "tavily" | "serper" | "brave" | "none";
  readonly apiKey?: string;
}

export interface WebSearchArgs {
  readonly query: string;
  readonly maxResults?: number;
  readonly signal?: AbortSignal;
}

export interface WebSearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

export async function webSearch(args: WebSearchArgs, config?: WebSearchConfig): Promise<string> {
  const provider = config?.provider ?? "none";
  const apiKey = config?.apiKey;

  if (provider === "none" || apiKey === undefined || apiKey.length === 0) {
    return "Web search not configured. Set search API key in config.";
  }

  try {
    const results = await searchWithProvider(provider, apiKey, args);
    if (results.length === 0) {
      return `No results found for query: "${args.query}"`;
    }
    return formatSearchResults(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Web search failed: ${message}. Query: "${args.query}"`;
  }
}

export function formatSearchResults(results: readonly WebSearchResult[]): string {
  return results
    .map((result, index) => `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.snippet}`)
    .join("\n\n");
}

async function searchWithProvider(
  provider: WebSearchConfig["provider"],
  apiKey: string,
  args: WebSearchArgs,
): Promise<WebSearchResult[]> {
  const maxResults = args.maxResults ?? 5;

  switch (provider) {
    case "tavily":
      return searchTavily(apiKey, args.query, maxResults, args.signal);
    case "serper":
      return searchSerper(apiKey, args.query, maxResults, args.signal);
    case "brave":
      return searchBrave(apiKey, args.query, maxResults, args.signal);
    default:
      return [];
  }
}

async function searchTavily(
  apiKey: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<WebSearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    ...(signal !== undefined ? { signal } : {}),
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? []).slice(0, maxResults).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    snippet: item.content ?? "",
  }));
}

async function searchSerper(
  apiKey: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<WebSearchResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    ...(signal !== undefined ? { signal } : {}),
    body: JSON.stringify({ q: query, num: maxResults }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (data.organic ?? []).slice(0, maxResults).map((item) => ({
    title: item.title ?? "",
    url: item.link ?? "",
    snippet: item.snippet ?? "",
  }));
}

async function searchBrave(
  apiKey: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<WebSearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    ...(signal !== undefined ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Brave search failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  return (data.web?.results ?? []).slice(0, maxResults).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    snippet: item.description ?? "",
  }));
}

export const webSearchSchema = {
  name: "web_search",
  description: "Search the web using a configured search API provider (tavily, serper, or brave).",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      maxResults: { type: "number", description: "Maximum number of results (default: 5)" },
    },
    required: ["query"],
  },
} as const;
