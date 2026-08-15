import type { EmbeddingAdapter, LlmConfig } from "@cantilune/boot";
import { fetchWithRetry, readErrorBody } from "../httpClient.js";
import type { AdapterOptions, ProviderEntry } from "../types.js";

/**
 * OpenAI-compatible `/embeddings` adapter.
 *
 * Every `openai-compatible` provider in the registry exposes the same
 * `POST {baseUrl}/embeddings` shape (`{ model, input }` → `{ data: [{ embedding }] }`),
 * so one mapping serves all of them. The adapter is the zero-training semantic
 * sensor for the termination controller's residual engine; it never owns a
 * decision and the residual engine falls back to Jaccard when it throws.
 */

export interface OpenAiEmbeddingResponse {
  readonly data?: readonly { readonly embedding?: readonly number[] }[];
  /** Some providers echo the requested model and/or dimensions. */
  readonly model?: string;
}

function resolveApiKey(config: LlmConfig, envKeyName: string): string | undefined {
  const fromConfig = config.apiKey?.();
  if (fromConfig) {
    return fromConfig;
  }
  if (envKeyName.length > 0) {
    return process.env[envKeyName];
  }
  return undefined;
}

function normalizeBaseUrl(baseUrl: string): string {
  let end = baseUrl.length;
  while (end > 0 && baseUrl[end - 1] === "/") {
    end--;
  }
  return baseUrl.slice(0, end);
}

/**
 * Build an {@link EmbeddingAdapter} against an OpenAI-compatible `/embeddings`
 * endpoint.
 *
 * Dimensionality is discovered from the first successful response and exposed
 * via a getter so later capacity accounting sees the real value without a second
 * probe; it reports `0` until that first call. The residual engine only reads
 * `dimensions` for capacity bookkeeping it tolerates being approximate, so a
 * zero placeholder before the first call is safe.
 */
export function createOpenAiEmbedder(
  config: LlmConfig,
  entry: ProviderEntry,
  options?: AdapterOptions,
): EmbeddingAdapter {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? entry.defaultBaseUrl);
  // Discovered from the first response; 0 until then.
  let knownDimensions = 0;

  function buildHeaders(): Record<string, string> {
    const apiKey = resolveApiKey(config, entry.envKeyName);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers,
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  async function post(texts: readonly string[]): Promise<Response> {
    const headers = buildHeaders();
    const response = await fetchWithRetry(`${baseUrl}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: config.model, input: texts }),
      ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
      ...(options?.retries !== undefined ? { retries: options.retries } : {}),
    });
    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`OpenAI-compatible embeddings error (${response.status}): ${detail}`);
    }
    return response;
  }

  return {
    get dimensions(): number {
      return knownDimensions;
    },
    async embed(texts: readonly string[]): Promise<readonly number[][]> {
      if (texts.length === 0) return [];
      const response = await post(texts);
      const payload = (await response.json()) as OpenAiEmbeddingResponse;
      const rows = payload.data ?? [];
      const vectors: number[][] = [];
      for (let i = 0; i < rows.length; i++) {
        const embedding = rows[i]?.embedding;
        if (embedding === undefined) {
          throw new Error("OpenAI-compatible embeddings response omitted an embedding vector");
        }
        vectors.push([...embedding]);
      }
      // Preserve the request order: the residual engine pairs goals/evidence by
      // index, so any reordering by the provider would silently corrupt the match.
      if (vectors.length !== texts.length) {
        throw new Error(
          `OpenAI-compatible embeddings returned ${vectors.length} vectors for ${texts.length} inputs`,
        );
      }
      const dim = vectors[0]?.length ?? 0;
      if (dim > 0) knownDimensions = dim;
      return vectors;
    },
  };
}
