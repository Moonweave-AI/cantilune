import type { LlmAdapter, LlmChatRequest, LlmConfig, LlmStreamChunk } from "@cantilune/boot";
import { fetchWithRetry, readErrorBody, readSseStream } from "../httpClient.js";
import type { AdapterOptions, ProviderEntry } from "../types.js";
import {
  fromOpenAiResponse,
  toOpenAiMessages,
  toOpenAiTools,
  decodeOpenAiToolName,
  StreamAccumulator,
  normalizeToolCallDelta,
  type OpenAiChoice,
  type OpenAiStreamChunk,
  type OpenAiUsage,
} from "./openaiToolMapping.js";

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

/**
 * The tool-call chunks carried by one streaming frame, in arrival order.
 *
 * Each raw delta is run through {@link normalizeToolCallDelta} first, so the
 * boot layer's strict `requireToolCallDelta` validator only ever sees a
 * well-formed `index` (non-negative integer) and a string `argumentsDelta`.
 * Unrecoverable frames are dropped here rather than killing the stream.
 */
function toolCallChunks(frame: OpenAiStreamChunk): LlmStreamChunk[] {
  const chunks: LlmStreamChunk[] = [];
  for (const rawDelta of frame.choices?.[0]?.delta?.tool_calls ?? []) {
    const delta = normalizeToolCallDelta(rawDelta);
    if (delta === undefined) continue;
    chunks.push({
      kind: "tool_call_delta",
      index: delta.index,
      ...(delta.id !== undefined ? { id: delta.id } : {}),
      ...(delta.name !== undefined ? { name: decodeOpenAiToolName(delta.name) } : {}),
      ...(delta.argumentsDelta !== undefined ? { argumentsDelta: delta.argumentsDelta } : {}),
    });
  }
  return chunks;
}

function normalizeBaseUrl(baseUrl: string): string {
  let end = baseUrl.length;
  while (end > 0 && baseUrl[end - 1] === "/") {
    end--;
  }
  return baseUrl.slice(0, end);
}

function isAzureProvider(entry: ProviderEntry): boolean {
  return entry.slug === "azure";
}

/** Resolve chat completions URL; Azure uses deployments + api-version. */
function chatCompletionsUrl(entry: ProviderEntry, baseUrl: string, model: string): string {
  if (!isAzureProvider(entry)) {
    return `${baseUrl}/chat/completions`;
  }
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION?.trim() || process.env.OPENAI_API_VERSION?.trim();
  if (apiVersion === undefined || apiVersion.length === 0) {
    throw new Error(
      "Azure OpenAI requires AZURE_OPENAI_API_VERSION or OPENAI_API_VERSION (fail-closed)",
    );
  }
  if (baseUrl.includes("{resource}") || baseUrl.includes("{deployment}")) {
    throw new Error(
      "Azure OpenAI requires an explicit baseUrl with the resource host " +
        "(and optionally /openai/deployments/{deployment}); placeholders are not callable",
    );
  }
  const path = baseUrl.includes("/openai/deployments/")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/openai/deployments/${encodeURIComponent(model)}/chat/completions`;
  return `${path}?api-version=${encodeURIComponent(apiVersion)}`;
}

export function createOpenAiCompatibleAdapter(
  config: LlmConfig,
  entry: ProviderEntry,
  options?: AdapterOptions,
): LlmAdapter {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? entry.defaultBaseUrl);

  function buildHeaders(): Record<string, string> {
    const apiKey = resolveApiKey(config, entry.envKeyName);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers,
    };
    if (apiKey) {
      if (isAzureProvider(entry)) {
        // Azure OpenAI rejects Bearer for the resource endpoint; it expects api-key.
        headers["api-key"] = apiKey;
      } else {
        headers.Authorization = `Bearer ${apiKey}`;
      }
    }
    return headers;
  }

  function buildBody(request: LlmChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: config.model,
      messages: toOpenAiMessages(request.messages),
    };
    if (request.tools.length > 0) {
      body.tools = toOpenAiTools(request.tools);
    }
    if (config.maxTokens !== undefined) {
      body.max_tokens = config.maxTokens;
    }
    if (config.temperature !== undefined) {
      body.temperature = config.temperature;
    }
    if (stream) {
      body.stream = true;
      // Most OpenAI-compatible endpoints omit usage from streams unless asked.
      body.stream_options = { include_usage: true };
    }
    return body;
  }

  async function post(request: LlmChatRequest, stream: boolean): Promise<Response> {
    const headers = buildHeaders();
    if (stream) {
      headers.Accept = "text/event-stream";
    }
    const response = await fetchWithRetry(chatCompletionsUrl(entry, baseUrl, config.model), {
      method: "POST",
      headers,
      body: JSON.stringify(buildBody(request, stream)),
      ...(request.signal !== undefined ? { signal: request.signal } : {}),
      ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
      ...(options?.retries !== undefined ? { retries: options.retries } : {}),
    });

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`OpenAI-compatible API error (${response.status}): ${detail}`);
    }
    return response;
  }

  return {
    async chat(request: LlmChatRequest) {
      const response = await post(request, false);
      const payload = (await response.json()) as {
        choices?: OpenAiChoice[];
        usage?: OpenAiUsage;
      };
      return fromOpenAiResponse(payload.choices?.[0], payload.usage);
    },

    async *stream(request: LlmChatRequest): AsyncGenerator<LlmStreamChunk> {
      const response = await post(request, true);
      const accumulator = new StreamAccumulator();

      for await (const payload of readSseStream(response)) {
        let frame: OpenAiStreamChunk;
        try {
          frame = JSON.parse(payload) as OpenAiStreamChunk;
        } catch {
          // A malformed frame should not kill an otherwise healthy stream.
          continue;
        }

        const textDelta = accumulator.push(frame);
        if (textDelta !== undefined) {
          yield { kind: "text_delta", text: textDelta };
        }

        for (const toolChunk of toolCallChunks(frame)) {
          yield toolChunk;
        }
      }

      yield { kind: "done", response: accumulator.finish() };
    },
  };
}
