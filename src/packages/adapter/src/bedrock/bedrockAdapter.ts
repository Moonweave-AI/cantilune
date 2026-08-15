import type { LlmAdapter, LlmChatRequest, LlmConfig } from "@cantilune/boot";
import { fetchWithRetry, readErrorBody } from "../httpClient.js";
import type { AdapterOptions, ProviderEntry } from "../types.js";
import {
  buildBedrockConverseUrl,
  resolveAwsCredentials,
  resolveAwsRegion,
  signAwsRequest,
} from "./awsSigV4.js";
import {
  fromBedrockResponse,
  splitSystemPrompt,
  toBedrockMessages,
  toBedrockTools,
} from "./bedrockToolMapping.js";

export function createBedrockAdapter(
  config: LlmConfig,
  _entry: ProviderEntry,
  options?: AdapterOptions,
): LlmAdapter {
  return {
    async chat(request: LlmChatRequest) {
      const credentials = resolveAwsCredentials(config.apiKey);
      const region = resolveAwsRegion(config.baseUrl);
      const url = buildBedrockConverseUrl(region, config.model, config.baseUrl);

      const { system, conversation } = splitSystemPrompt(request.messages);
      const body: Record<string, unknown> = {
        messages: toBedrockMessages(conversation),
      };

      if (system.length > 0) {
        body.system = system;
      }

      const inferenceConfig: Record<string, unknown> = {};
      if (config.maxTokens !== undefined) {
        inferenceConfig.maxTokens = config.maxTokens;
      }
      if (config.temperature !== undefined) {
        inferenceConfig.temperature = config.temperature;
      }
      if (Object.keys(inferenceConfig).length > 0) {
        body.inferenceConfig = inferenceConfig;
      }

      if (request.tools.length > 0) {
        body.toolConfig = {
          tools: toBedrockTools(request.tools),
        };
      }

      const payload = JSON.stringify(body);
      const signed = signAwsRequest({
        method: "POST",
        url,
        region,
        service: "bedrock",
        body: payload,
        credentials,
        ...(options?.headers !== undefined ? { extraHeaders: options.headers } : {}),
      });

      const response = await fetchWithRetry(signed.url, {
        method: "POST",
        headers: signed.headers,
        body: payload,
        // Forwarded so a cancelled run stops the request: without it an aborted
        // turn kept the generation alive to completion and still billed for it.
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
        ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
        ...(options?.retries !== undefined ? { retries: options.retries } : {}),
      });

      if (!response.ok) {
        const detail = await readErrorBody(response);
        throw new Error(`AWS Bedrock API error (${response.status}): ${detail}`);
      }

      const result = (await response.json()) as Parameters<typeof fromBedrockResponse>[0];
      return fromBedrockResponse(result);
    },
  };
}
