import type { ToolSchema } from "@cantilune/syscall";
import type { McpClient, McpToolSchema } from "./mcpBridge.js";

export interface McpToolCache {
  readonly serverName: string;
  readonly tools: ToolSchema[];
  readonly connected: boolean;
}

const discoveryCache = new Map<string, McpToolCache>();

/**
 * Discover tools from a connected MCP client and cache the result per server name.
 */
export async function discoverMcpTools(
  client: McpClient,
  serverName: string,
): Promise<McpToolCache> {
  const cached = discoveryCache.get(serverName);
  if (cached !== undefined) {
    return cached;
  }

  const mcpTools = await client.listTools();
  const cache: McpToolCache = {
    serverName,
    connected: true,
    tools: mcpTools.map((tool) => mcpToolToSchema(serverName, tool)),
  };

  discoveryCache.set(serverName, cache);
  return cache;
}

export function mcpToolToSchema(serverName: string, tool: McpToolSchema): ToolSchema {
  return {
    name: `mcp_${serverName}_${tool.name}`,
    description:
      tool.description.length > 0
        ? tool.description
        : `MCP tool "${tool.name}" on server "${serverName}"`,
    parameters: tool.inputSchema,
  };
}

export function getCachedToolSchemas(caches: readonly McpToolCache[]): ToolSchema[] {
  return caches.flatMap((cache) => cache.tools);
}

/** Clear discovery cache (for tests). */
export function clearMcpDiscoveryCache(): void {
  discoveryCache.clear();
}
