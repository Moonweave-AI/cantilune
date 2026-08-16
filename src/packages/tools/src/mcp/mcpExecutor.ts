import type { ToolExecutor, ToolSchema } from "@cantilune/syscall";
import type { OsSandbox } from "../sandbox/osSandbox.js";
import type { McpConfig } from "../types.js";
import { createMcpClient, formatMcpToolResult } from "./mcpBridge.js";
import { discoverMcpTools, type McpToolCache } from "./mcpDiscovery.js";

export interface McpExecutor extends ToolExecutor {
  dispose(): void;
}

export function createMcpExecutor(config: McpConfig, sandbox?: OsSandbox): McpExecutor {
  const client = createMcpClient(config, sandbox !== undefined ? { sandbox } : {});
  let cache: McpToolCache | null = null;
  let connectPromise: Promise<void> | null = null;

  async function ensureReady(): Promise<McpToolCache> {
    if (cache !== null) {
      return cache;
    }

    connectPromise ??= (async () => {
      await client.connect();
      cache = await discoverMcpTools(client, config.name);
    })();

    await connectPromise;

    if (cache === null) {
      throw new Error("MCP discovery failed");
    }

    return cache;
  }

  const toolPrefix = `mcp_${config.name}_`;

  return {
    // ADR-0016 §3: an MCP server exposes arbitrary remote tools whose side
    // effects and idempotency are unknown to this executor. Default to the
    // fail-safe Tier 2 (non-idempotent): after a crash with a dispatched
    // journal entry and no durable output the run reports ambiguous rather
    // than re-dispatching an unknown remote side effect.
    tier: "non-idempotent",

    async listTools(): Promise<ToolSchema[]> {
      try {
        const ready = await ensureReady();
        return ready.tools;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return [
          {
            name: `${toolPrefix}unavailable`,
            description: `MCP server "${config.name}" unavailable: ${message}`,
            parameters: { type: "object", properties: {} },
          },
        ];
      }
    },

    dispose(): void {
      client.disconnect();
    },

    async execute(
      name: string,
      args: Record<string, unknown>,
      options?: { readonly signal?: AbortSignal },
    ): Promise<{ ok: boolean; output: string }> {
      if (options?.signal?.aborted === true) {
        return { ok: false, output: "skipped: aborted before MCP dispatch" };
      }
      if (name === `${toolPrefix}unavailable`) {
        return { ok: false, output: `MCP server "${config.name}" is not connected` };
      }

      try {
        const ready = await ensureReady();
        const tool = ready.tools.find((entry) => entry.name === name);
        if (tool === undefined) {
          return { ok: false, output: `Unknown MCP tool: ${name}` };
        }

        const remoteName = name.startsWith(toolPrefix) ? name.slice(toolPrefix.length) : name;
        const result = await client.callTool(remoteName, args);
        const output = formatMcpToolResult(result);
        return { ok: result.isError !== true, output };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, output: message };
      }
    },
  };
}
