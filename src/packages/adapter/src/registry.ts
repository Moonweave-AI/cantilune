import type { EmbeddingAdapter, LlmAdapter, LlmConfig } from "@cantilune/boot";
import { createAnthropicAdapter } from "./anthropic/anthropicAdapter.js";
import { createBedrockAdapter } from "./bedrock/bedrockAdapter.js";
import { createGoogleAdapter } from "./google/googleAdapter.js";
import { createOpenAiCompatibleAdapter } from "./openaiCompatible/openaiCompatibleAdapter.js";
import { createOpenAiEmbedder } from "./openaiCompatible/openAiEmbeddingsAdapter.js";
import type { AdapterOptions, ProviderEntry } from "./types.js";

const PROVIDERS: readonly ProviderEntry[] = [
  {
    slug: "openai",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    envKeyName: "OPENAI_API_KEY",
  },
  {
    slug: "azure",
    tier: "openai-compatible",
    defaultBaseUrl: "https://{resource}.openai.azure.com",
    envKeyName: "AZURE_OPENAI_API_KEY",
  },
  {
    slug: "deepseek",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    envKeyName: "DEEPSEEK_API_KEY",
  },
  {
    slug: "groq",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    envKeyName: "GROQ_API_KEY",
  },
  {
    slug: "together",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.together.xyz/v1",
    envKeyName: "TOGETHER_API_KEY",
  },
  {
    slug: "fireworks",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    envKeyName: "FIREWORKS_API_KEY",
  },
  {
    slug: "cerebras",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    envKeyName: "CEREBRAS_API_KEY",
  },
  {
    slug: "ollama",
    tier: "openai-compatible",
    defaultBaseUrl: "http://localhost:11434/v1",
    envKeyName: "",
  },
  {
    slug: "openrouter",
    tier: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    envKeyName: "OPENROUTER_API_KEY",
  },
  {
    slug: "perplexity",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.perplexity.ai",
    envKeyName: "PERPLEXITY_API_KEY",
  },
  {
    slug: "mistral",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    envKeyName: "MISTRAL_API_KEY",
  },
  {
    slug: "xai",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.x.ai/v1",
    envKeyName: "XAI_API_KEY",
  },
  {
    slug: "zhipu",
    tier: "openai-compatible",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    envKeyName: "ZHIPU_API_KEY",
  },
  {
    slug: "moonshot",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    envKeyName: "MOONSHOT_API_KEY",
  },
  {
    slug: "dashscope",
    tier: "openai-compatible",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    envKeyName: "DASHSCOPE_API_KEY",
  },
  {
    slug: "yi",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.lingyiwanwu.com/v1",
    envKeyName: "YI_API_KEY",
  },
  {
    slug: "baichuan",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.baichuan-ai.com/v1",
    envKeyName: "BAICHUAN_API_KEY",
  },
  {
    slug: "deepinfra",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.deepinfra.com/v1/openai",
    envKeyName: "DEEPINFRA_API_KEY",
  },
  {
    slug: "lambda",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.lambdalabs.com/v1",
    envKeyName: "LAMBDA_API_KEY",
  },
  {
    slug: "nebius",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.studio.nebius.ai/v1",
    envKeyName: "NEBIUS_API_KEY",
  },
  {
    slug: "novita",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.novita.ai/v3/openai",
    envKeyName: "NOVITA_API_KEY",
  },
  {
    slug: "anthropic",
    tier: "native",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    envKeyName: "ANTHROPIC_API_KEY",
  },
  {
    slug: "google",
    tier: "native",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    envKeyName: "GOOGLE_API_KEY",
  },
  { slug: "bedrock", tier: "native", defaultBaseUrl: "", envKeyName: "AWS_ACCESS_KEY_ID" },
] as const;

const providerIndex = new Map<string, ProviderEntry>(PROVIDERS.map((entry) => [entry.slug, entry]));

export function getProvider(slug: string): ProviderEntry | undefined {
  return providerIndex.get(slug.toLowerCase());
}

export function listProviders(): ProviderEntry[] {
  return [...PROVIDERS];
}

function createFallbackEntry(config: LlmConfig): ProviderEntry {
  return {
    slug: config.provider,
    tier: "openai-compatible",
    defaultBaseUrl: config.baseUrl ?? "",
    envKeyName: "",
  };
}

export function createAdapter(config: LlmConfig, options?: AdapterOptions): LlmAdapter {
  const entry = getProvider(config.provider);

  if (entry?.tier === "openai-compatible") {
    return createOpenAiCompatibleAdapter(config, entry, options);
  }

  if (entry?.tier === "native") {
    switch (entry.slug) {
      case "anthropic":
        return createAnthropicAdapter(config, entry, options);
      case "google":
        return createGoogleAdapter(config, entry, options);
      case "bedrock":
        return createBedrockAdapter(config, entry, options);
      default:
        break;
    }
  }

  if (config.baseUrl !== undefined && config.baseUrl.length > 0) {
    return createOpenAiCompatibleAdapter(config, createFallbackEntry(config), options);
  }

  throw new Error(
    `Unknown provider "${config.provider}". Provide baseUrl for custom OpenAI-compatible endpoints.`,
  );
}

/**
 * Build an {@link EmbeddingAdapter} for the same provider/model, or `undefined`
 * when the provider has no embeddings surface the CLI can rely on.
 *
 * Only `openai-compatible` providers (and any custom `baseUrl` fallback) expose a
 * uniform `/embeddings` endpoint, so they get a real embedder. Native providers
 * (anthropic, google, bedrock) have no shared embeddings surface; rather than
 * pick a per-vendor embedding path here, this returns `undefined` so the caller
 * — the termination controller's residual engine — degrades to its Jaccard
 * fallback. Termination safety therefore never depends on an embedding round
 * trip, matching the design contract (embedder is an optional semantic sensor).
 *
 * Reuses the same config (apiKey, baseUrl) as the chat adapter; it does not
 * consume the loop's chat adapter.
 */
export function createEmbedder(
  config: LlmConfig,
  options?: AdapterOptions,
): EmbeddingAdapter | undefined {
  const entry = getProvider(config.provider);

  if (entry?.tier === "openai-compatible") {
    return createOpenAiEmbedder(config, entry, options);
  }

  if (entry?.tier === "native") {
    // Native providers have no uniform /embeddings surface; let the caller fall
    // back to keyword matching rather than forcing a vendor-specific path.
    return undefined;
  }

  if (config.baseUrl !== undefined && config.baseUrl.length > 0) {
    return createOpenAiEmbedder(config, createFallbackEntry(config), options);
  }

  return undefined;
}
