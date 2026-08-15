import type { LlmAdapter, LlmChatRequest, LlmConfig, LlmStreamChunk } from "@cantilune/boot";
import { fetchWithRetry, readErrorBody, readSseStream } from "../httpClient.js";
import type { AdapterOptions, ProviderEntry } from "../types.js";
import {
  fromAnthropicResponse,
  splitSystemPrompt,
  toAnthropicMessages,
  toAnthropicTools,
  AnthropicStreamAccumulator,
  type AnthropicStreamEvent,
  type AnthropicResponseContentBlock,
  type AnthropicUsage,
} from "./anthropicToolMapping.js";

const ANTHROPIC_VERSION = "2023-06-01";

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

/** The tool-call chunk an SSE event carries, or undefined when it carries none. */
function toolCallChunk(event: AnthropicStreamEvent): LlmStreamChunk | undefined {
  if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
    return {
      kind: "tool_call_delta",
      index: event.index ?? 0,
      ...(event.content_block.id !== undefined ? { id: event.content_block.id } : {}),
      ...(event.content_block.name !== undefined ? { name: event.content_block.name } : {}),
    };
  }
  if (event.type === "content_block_delta" && event.delta?.partial_json !== undefined) {
    return {
      kind: "tool_call_delta",
      index: event.index ?? 0,
      argumentsDelta: event.delta.partial_json,
    };
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

export function createAnthropicAdapter(
  config: LlmConfig,
  entry: ProviderEntry,
  options?: AdapterOptions,
): LlmAdapter {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? entry.defaultBaseUrl);

  function buildHeaders(): Record<string, string> {
    const apiKey = resolveApiKey(config, entry.envKeyName);
    if (!apiKey) {
      throw new Error("Anthropic API key is required");
    }
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      ...options?.headers,
    };
  }

  function buildBody(request: LlmChatRequest, stream: boolean): Record<string, unknown> {
    const { system, conversation } = splitSystemPrompt(request.messages);
    const body: Record<string, unknown> = {
      model: config.model,
      messages: toAnthropicMessages(conversation),
      max_tokens: config.maxTokens ?? 4096,
    };
    if (system !== undefined) {
      body.system = system;
    }
    if (request.tools.length > 0) {
      body.tools = toAnthropicTools(request.tools);
    }
    if (config.temperature !== undefined) {
      body.temperature = config.temperature;
    }
    if (stream) {
      body.stream = true;
    }
    return body;
  }

  async function post(request: LlmChatRequest, stream: boolean): Promise<Response> {
    const headers = buildHeaders();
    if (stream) {
      headers.Accept = "text/event-stream";
    }
    const response = await fetchWithRetry(`${baseUrl}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(buildBody(request, stream)),
      ...(request.signal !== undefined ? { signal: request.signal } : {}),
      ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
      ...(options?.retries !== undefined ? { retries: options.retries } : {}),
    });

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`Anthropic API error (${response.status}): ${detail}`);
    }
    return response;
  }

  return {
    async chat(request: LlmChatRequest) {
      const response = await post(request, false);
      const payload = (await response.json()) as {
        content?: readonly AnthropicResponseContentBlock[];
        stop_reason?: string;
        usage?: AnthropicUsage;
      };
      return fromAnthropicResponse(payload);
    },

    async *stream(request: LlmChatRequest): AsyncGenerator<LlmStreamChunk> {
      const response = await post(request, true);
      const accumulator = new AnthropicStreamAccumulator();

      for await (const payload of readSseStream(response)) {
        let event: AnthropicStreamEvent;
        try {
          event = JSON.parse(payload) as AnthropicStreamEvent;
        } catch {
          continue;
        }

        const textDelta = accumulator.push(event);
        if (textDelta !== undefined) {
          yield { kind: "text_delta", text: textDelta };
        }

        const toolChunk = toolCallChunk(event);
        if (toolChunk !== undefined) {
          yield toolChunk;
        }
      }

      yield { kind: "done", response: accumulator.finish() };
    },
  };
}
