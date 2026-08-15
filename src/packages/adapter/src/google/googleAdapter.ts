import type { LlmAdapter, LlmChatRequest, LlmConfig } from "@cantilune/boot";
import { fetchWithRetry, readErrorBody } from "../httpClient.js";
import type { AdapterOptions, ProviderEntry } from "../types.js";
import { fromGoogleResponse, toGoogleContents, toGoogleTools } from "./googleToolMapping.js";

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

export function createGoogleAdapter(
  config: LlmConfig,
  entry: ProviderEntry,
  options?: AdapterOptions,
): LlmAdapter {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? entry.defaultBaseUrl);

  return {
    async chat(request: LlmChatRequest) {
      const apiKey = resolveApiKey(config, entry.envKeyName);
      if (!apiKey) {
        throw new Error("Google API key is required");
      }

      const body: Record<string, unknown> = {
        contents: toGoogleContents(request.messages),
      };

      const tools = toGoogleTools(request.tools);
      if (tools.length > 0) {
        body.tools = tools;
      }

      const generationConfig: Record<string, unknown> = {};
      if (config.maxTokens !== undefined) {
        generationConfig.maxOutputTokens = config.maxTokens;
      }
      if (config.temperature !== undefined) {
        generationConfig.temperature = config.temperature;
      }
      if (Object.keys(generationConfig).length > 0) {
        body.generationConfig = generationConfig;
      }

      const url = `${baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options?.headers,
      };

      const response = await fetchWithRetry(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        // Forwarded so a cancelled run stops the request: without it an aborted
        // turn kept the generation alive to completion and still billed for it.
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
        ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
        ...(options?.retries !== undefined ? { retries: options.retries } : {}),
      });

      if (!response.ok) {
        const detail = await readErrorBody(response);
        throw new Error(`Google Gemini API error (${response.status}): ${detail}`);
      }

      const payload = (await response.json()) as Parameters<typeof fromGoogleResponse>[0];
      return fromGoogleResponse(payload);
    },
  };
}
