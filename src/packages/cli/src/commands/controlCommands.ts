import { listProviders } from "@cantilune/adapter";
import type { SlashCommand, CommandCategory, CommandServices } from "./registry.js";
import type { AppStore } from "../store.js";
import { missingApiKeyVar } from "../runtimeSync.js";
import { updateConfig } from "../config.js";
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
      name: "/contract-model",
      description: "Set dedicated goal-contract LLM: /contract-model <provider> <model>",
      category: control,
      args: [
        { name: "provider", description: "Provider slug", required: true, type: "string" },
        { name: "model", description: "Model id", required: true, type: "string" },
      ],
      handler: async (args, store, services) => {
        const provider = typeof args["provider"] === "string" ? args["provider"] : "";
        const model = typeof args["model"] === "string" ? args["model"] : "";
        if (provider.length === 0 || model.length === 0) {
          services?.notify?.("warn", "usage: /contract-model <provider> <model>");
          return;
        }
        store.contractProvider = provider;
        store.contractModel = model;
        await updateConfig({ contractProvider: provider, contractModel: model });
        services?.notify?.("info", `contract LLM=${model} @ ${provider} (separate from loop)`);
      },
    },
    {
      name: "/judge-model",
      description: "Set dedicated LLM judge: /judge-model <provider> <model>",
      category: control,
      args: [
        { name: "provider", description: "Provider slug", required: true, type: "string" },
        { name: "model", description: "Model id", required: true, type: "string" },
      ],
      handler: async (args, store, services) => {
        const provider = typeof args["provider"] === "string" ? args["provider"] : "";
        const model = typeof args["model"] === "string" ? args["model"] : "";
        if (provider.length === 0 || model.length === 0) {
          services?.notify?.("warn", "usage: /judge-model <provider> <model>");
          return;
        }
        store.judgeProvider = provider;
        store.judgeModel = model;
        await updateConfig({ judgeProvider: provider, judgeModel: model });
        services?.notify?.("info", `judge LLM=${model} @ ${provider} (separate from loop)`);
      },
    },
    {
      name: "/judge-quorum",
      description: "Set judge quorum models (same provider): /judge-quorum <model>[,model...]",
      category: control,
      args: [
        {
          name: "models",
          description: "Comma-separated model ids",
          required: true,
          type: "string",
        },
      ],
      handler: async (args, store, services) => {
        const raw = typeof args["models"] === "string" ? args["models"] : "";
        const models = raw
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m.length > 0);
        if (models.length === 0) {
          services?.notify?.("warn", "usage: /judge-quorum <model>[,model...]");
          return;
        }
        store.judgeQuorumModels = models;
        await updateConfig({ judgeQuorumModels: models });
        services?.notify?.("info", `judge quorum models=${models.join(",")}`);
      },
    },
    {
      name: "/tools",
      description: "List registered tools and their availability",
      category: control,
      handler: async (_args, store, services) => {
        store.mode = "view";
        store.activeView = "tools";
        const injectedTools = (await services?.listInjectedTools?.()) ?? [];
        store.viewArgs = { injectedTools };
      },
    },
    {
      name: "/tools test",
      description: "Dry-run a tool by name",
      category: control,
      args: [{ name: "name", description: "Tool name", required: true, type: "string" }],
      handler: async (args, store, services) => {
        store.mode = "view";
        store.activeView = "tools-test";
        const injectedTools = (await services?.listInjectedTools?.()) ?? [];
        store.viewArgs = { ...args, injectedTools };
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
      handler: async (args, store, services) => {
        const spec = typeof args.url === "string" ? args.url : "";
        store.mode = "view";
        store.activeView = "mcp-connect";
        const { parseMcpServerSpec } = await import("../wiring/cliToolSet.js");
        const { scheduleMcpAttach } = await import("../wiring/mcpAttach.js");
        const parsed = parseMcpServerSpec(spec);
        if (parsed.rejected !== undefined) {
          store.viewArgs = { url: spec, persisted: false, error: parsed.rejected };
          services?.notify?.("error", parsed.rejected);
          return;
        }
        const next = [...new Set([...(store.mcpServers ?? []), spec])];
        store.mcpServers = next;
        await services?.persistConfig?.({ mcpServers: next });
        const pending = await scheduleMcpAttach({
          store,
          ...(services !== undefined ? { services } : {}),
          action: "connect",
          servers: next,
        });
        store.viewArgs = {
          url: spec,
          persisted: true,
          scheduled: true,
          ...(pending.admissionId !== undefined ? { admissionId: pending.admissionId } : {}),
        };
        services?.notify?.(
          "info",
          `Scheduled MCP ${spec} for the next turn (epoch-bound attach; current turn keeps the old tool surface)`,
        );
      },
    },
    {
      name: "/mcp disconnect",
      description: "Disconnect an MCP server after the current turn",
      category: control,
      args: [{ name: "name", description: "MCP server name", required: true, type: "string" }],
      handler: async (args, store, services) => {
        const name = typeof args.name === "string" ? args.name : "";
        store.mode = "view";
        store.activeView = "mcp-disconnect";
        const { parseMcpServerSpec } = await import("../wiring/cliToolSet.js");
        const { scheduleMcpAttach } = await import("../wiring/mcpAttach.js");
        const remaining = (store.mcpServers ?? []).filter((spec) => {
          const parsed = parseMcpServerSpec(spec);
          return parsed.config?.name !== name && spec !== name;
        });
        if (remaining.length === (store.mcpServers ?? []).length) {
          store.viewArgs = { name, persisted: false, error: `MCP server not connected: ${name}` };
          services?.notify?.("error", `MCP server not connected: ${name}`);
          return;
        }
        store.mcpServers = remaining.length > 0 ? remaining : undefined;
        await services?.persistConfig?.({
          mcpServers: remaining.length > 0 ? remaining : undefined,
        });
        const pending = await scheduleMcpAttach({
          store,
          ...(services !== undefined ? { services } : {}),
          action: "disconnect",
          servers: remaining,
        });
        store.viewArgs = {
          name,
          persisted: true,
          scheduled: true,
          ...(pending.admissionId !== undefined ? { admissionId: pending.admissionId } : {}),
        };
        services?.notify?.(
          "info",
          `Scheduled MCP disconnect ${name} for the next turn (current turn keeps the old tool surface)`,
        );
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
