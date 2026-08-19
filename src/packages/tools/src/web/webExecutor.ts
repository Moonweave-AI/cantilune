import type { ToolExecutor, ToolSchema } from "@cantilune/syscall";
import type { WebConfig } from "../types.js";
import { webFetch, webFetchSchema } from "./webFetch.js";
import { webSearch, webSearchSchema } from "./webSearch.js";

const WEB_SCHEMAS: ToolSchema[] = [webSearchSchema, webFetchSchema];

export function createWebExecutor(config: WebConfig): ToolExecutor {
  return {
    // ADR-0016 §3: web_search and web_fetch are read-only (no side effect); a
    // crash at any boundary is closed by re-dispatch.
    tier: "read",

    async listTools(): Promise<ToolSchema[]> {
      return WEB_SCHEMAS;
    },

    async execute(
      toolName: string,
      args: Record<string, unknown>,
      options?: { readonly signal?: AbortSignal },
    ): Promise<{ ok: boolean; output: string }> {
      if (options?.signal?.aborted === true) {
        return { ok: false, output: "skipped: aborted before web dispatch" };
      }
      try {
        switch (toolName) {
          case "web_search": {
            const query = requireString(args, "query");
            const searchConfig: {
              provider: "cloakbrowser" | "tavily" | "serper" | "brave" | "none";
              apiKey?: string;
            } = {
              provider: config.searchProvider ?? "cloakbrowser",
            };
            if (config.searchApiKey !== undefined) {
              searchConfig.apiKey = config.searchApiKey;
            }
            const output = await webSearch(
              {
                query,
                ...(args.maxResults !== undefined
                  ? { maxResults: requireNumber(args, "maxResults") }
                  : {}),
                ...(options?.signal !== undefined ? { signal: options.signal } : {}),
              },
              searchConfig,
            );
            return { ok: true, output };
          }
          case "web_fetch": {
            const url = requireString(args, "url");
            const output = await webFetch(
              {
                url,
                ...(args.maxLength !== undefined
                  ? { maxLength: requireNumber(args, "maxLength") }
                  : {}),
                ...(options?.signal !== undefined ? { signal: options.signal } : {}),
              },
              config,
            );
            return { ok: true, output };
          }
          default:
            return { ok: false, output: `Unknown web tool: ${toolName}` };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, output: message };
      }
    },
  };
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new TypeError(`Expected string argument: ${key}`);
  }
  return value;
}

function requireNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`Expected number argument: ${key}`);
  }
  return value;
}
