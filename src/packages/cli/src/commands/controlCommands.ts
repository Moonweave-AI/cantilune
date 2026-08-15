import { listProviders } from "@cantilune/adapter";
import type { SlashCommand, CommandCategory, CommandServices } from "./registry.js";
import type { AppStore } from "../store.js";
import { missingApiKeyVar } from "../runtimeSync.js";
import { THEME_NAMES, isThemeName } from "../theme/palette.js";

/** One-line rationale per theme, shown in the `/theme` picker. */
const THEME_BLURB: Record<string, string> = {
  moonlight: "cool truecolor, tuned for dark terminals",
  daylight: "high-contrast truecolor for light backgrounds",
  ansi: "16-colour, follows your terminal palette",
  mono: "no colour; bold and dim only",
};

/** Curated defaults per provider, used when `/model` is invoked without an argument. */
const MODEL_SUGGESTIONS: Record<string, readonly string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o3", "o4-mini"],
  anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-haiku-20241022"],
  dashscope: ["qwen-plus", "qwen-max", "qwen3-235b-a22b", "qwen-turbo"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  ollama: ["llama3.1", "qwen2.5", "mistral"],
  moonshot: ["moonshot-v1-128k", "kimi-k2"],
  zhipu: ["glm-4-plus", "glm-4-flash"],
};

function providerOptions(services?: CommandServices): readonly { id: string; label: string }[] {
  if (services?.listProviders !== undefined) {
    return services.listProviders();
  }
  return listProviders().map((entry) => ({
    id: entry.slug,
    label: `${entry.slug} (${entry.tier})`,
  }));
}

function modelOptions(provider: string): readonly { id: string; label: string }[] {
  return (MODEL_SUGGESTIONS[provider] ?? []).map((model) => ({ id: model, label: model }));
}

/**
 * Keep `current` only when it plausibly belongs to `provider`.
 *
 * Model ids are provider-scoped, so carrying `gpt-4o` into DashScope produces a
 * "model does not exist" 404 that reads like an outage rather than a settings
 * mistake. Providers with no curated list keep whatever is set, since we cannot
 * tell a valid id from an invalid one there.
 */
function modelForProvider(provider: string, current: string): string {
  const suggestions = MODEL_SUGGESTIONS[provider] ?? [];
  if (suggestions.length === 0 || suggestions.includes(current)) return current;
  return suggestions[0] ?? current;
}

/**
 * Apply a provider/model switch: update the store, persist it, and drop the
 * cached runtime so the next run rebuilds the adapter with the new settings.
 */
async function applyLlmChange(
  store: AppStore,
  services: CommandServices | undefined,
  patch: { provider?: string; model?: string; baseUrl?: string },
): Promise<void> {
  const providerChanged = patch.provider !== undefined && patch.provider !== store.provider;

  if (patch.provider !== undefined) store.provider = patch.provider;
  if (patch.model !== undefined) store.model = patch.model;
  if (patch.baseUrl !== undefined) store.baseUrl = patch.baseUrl;

  // Both the model and any base-URL override belong to the provider they were
  // chosen for, so a bare `/provider X` has to retire them rather than point
  // the new provider at the old endpoint with the old model id.
  if (providerChanged) {
    if (patch.model === undefined) store.model = modelForProvider(store.provider, store.model);
    if (patch.baseUrl === undefined) store.baseUrl = undefined;
  }

  const reset = await services?.resetRuntime?.("preserve");
  await services?.persistConfig?.({
    provider: store.provider,
    model: store.model,
    baseUrl: store.baseUrl,
  });

  const missing = missingApiKeyVar(store.provider);
  const resetNotice =
    reset?.reason === "memory_world_replaced"
      ? " Memory runtime/content world was replaced; private and visible history were cleared."
      : "";
  if (missing !== null) {
    services?.notify?.(
      "warn",
      `${store.model} @ ${store.provider} — set ${missing} before running.${resetNotice}`,
    );
    return;
  }
  services?.notify?.(
    resetNotice.length > 0 ? "warn" : "info",
    `Using ${store.model} @ ${store.provider}.${resetNotice}`,
  );
}

export function registerControlCommands(): SlashCommand[] {
  const control = "control" as CommandCategory;
  return [
    {
      name: "/provider",
      description: "Show or switch the LLM provider",
      category: control,
      args: [{ name: "name", description: "Provider slug", required: false, type: "string" }],
      handler: async (args, store, services) => {
        const requested = typeof args["name"] === "string" ? args["name"] : undefined;
        if (requested !== undefined) {
          await applyLlmChange(store, services, { provider: requested });
          return;
        }

        const options = providerOptions(services);
        const chosen = await services?.pick?.("Select provider", options);
        if (chosen !== null && chosen !== undefined) {
          await applyLlmChange(store, services, { provider: chosen });
          return;
        }
        // No interactive picker available (headless/inspect): report current value.
        services?.notify?.("info", `provider=${store.provider}`);
      },
    },
    {
      name: "/model",
      description: "Show or switch the model for the current provider",
      category: control,
      args: [{ name: "name", description: "Model id", required: false, type: "string" }],
      handler: async (args, store, services) => {
        const requested = typeof args["name"] === "string" ? args["name"] : undefined;
        if (requested !== undefined) {
          await applyLlmChange(store, services, { model: requested });
          return;
        }

        const options = modelOptions(store.provider);
        if (options.length === 0) {
          services?.notify?.(
            "warn",
            `No suggestions for ${store.provider} — pass a model id: /model <id>`,
          );
          return;
        }
        const chosen = await services?.pick?.(`Select model for ${store.provider}`, options);
        if (chosen !== null && chosen !== undefined) {
          await applyLlmChange(store, services, { model: chosen });
          return;
        }
        services?.notify?.("info", `model=${store.model}`);
      },
    },
    {
      name: "/base-url",
      description: "Override the API base URL for the current provider",
      category: control,
      args: [{ name: "url", description: "Base URL", required: true, type: "string" }],
      handler: async (args, store, services) => {
        const url = typeof args["url"] === "string" ? args["url"] : "";
        await applyLlmChange(store, services, { baseUrl: url });
      },
    },
    {
      name: "/tools",
      description: "List registered tools and their availability",
      category: control,
      handler: (_args, store) => {
        store.mode = "view";
        store.activeView = "tools";
        store.viewArgs = {};
      },
    },
    {
      name: "/tools test",
      description: "Dry-run a tool by name",
      category: control,
      args: [{ name: "name", description: "Tool name", required: true, type: "string" }],
      handler: (args, store) => {
        store.mode = "view";
        store.activeView = "tools-test";
        store.viewArgs = { ...args };
      },
    },
    {
      name: "/mcp",
      description: "List MCP server connections",
      category: control,
      handler: (_args, store) => {
        store.mode = "view";
        store.activeView = "mcp";
        store.viewArgs = {};
      },
    },
    {
      name: "/mcp connect",
      description: "Connect to an MCP server",
      category: control,
      args: [{ name: "url", description: "MCP server URL", required: true, type: "string" }],
      handler: (args, store) => {
        store.mode = "view";
        store.activeView = "mcp-connect";
        store.viewArgs = { ...args };
      },
    },
    {
      name: "/layout",
      description: "Toggle between focus and observe layouts",
      category: control,
      args: [{ name: "mode", description: "focus | observe", required: false, type: "string" }],
      handler: async (args, store, services) => {
        const requested = typeof args["mode"] === "string" ? args["mode"] : undefined;
        const toggled = store.layout === "focus" ? "observe" : "focus";
        const next = requested === "focus" || requested === "observe" ? requested : toggled;
        store.layout = next;
        store.mode = "chat";
        store.activeView = null;
        await services?.persistConfig?.({ layout: next });
      },
    },
    {
      name: "/theme",
      description: "Show or switch the colour theme",
      category: control,
      args: [
        { name: "name", description: THEME_NAMES.join(" | "), required: false, type: "string" },
      ],
      handler: async (args, store, services) => {
        const requested = typeof args["name"] === "string" ? args["name"] : undefined;

        if (requested !== undefined) {
          if (!isThemeName(requested)) {
            services?.notify?.(
              "warn",
              `Unknown theme "${requested}" — try ${THEME_NAMES.join(", ")}`,
            );
            return;
          }
          store.theme = requested;
          await services?.persistConfig?.({ theme: requested });
          services?.notify?.("info", `Theme set to ${requested}`);
          return;
        }

        const chosen = await services?.pick?.(
          "Select theme",
          THEME_NAMES.map((name) => ({
            id: name,
            label: name.padEnd(10) + (THEME_BLURB[name] ?? ""),
          })),
        );
        if (chosen !== null && chosen !== undefined && isThemeName(chosen)) {
          store.theme = chosen;
          await services?.persistConfig?.({ theme: chosen });
          services?.notify?.("info", `Theme set to ${chosen}`);
          return;
        }
        services?.notify?.("info", `theme=${store.theme ?? "auto"}`);
      },
    },
    {
      name: "/config",
      description: "Show current CLI configuration and where it is stored",
      category: control,
      handler: (_args, store) => {
        store.mode = "view";
        store.activeView = "config";
        store.viewArgs = {};
      },
    },
    {
      name: "/config save",
      description: "Persist the current provider, model, and layout to disk",
      category: control,
      handler: async (_args, store, services) => {
        await services?.persistConfig?.({
          provider: store.provider,
          model: store.model,
          layout: store.layout,
          ...(store.theme !== null ? { theme: store.theme } : {}),
          ...(store.baseUrl !== undefined ? { baseUrl: store.baseUrl } : {}),
        });
        services?.notify?.("info", "Configuration saved");
      },
    },
  ];
}
