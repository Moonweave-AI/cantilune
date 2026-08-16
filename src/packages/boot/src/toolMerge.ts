import type { ToolExecutor, ToolSchema } from "@cantilune/syscall";
import type { CompositeToolExecutor } from "./types.js";

const indexCacheStore = new WeakMap<CompositeToolExecutor, Map<string, ToolExecutor> | undefined>();

/**
 * Merge multiple ToolExecutors into one composite executor.
 * Builds an internal name→executor index on first use for O(1) dispatch.
 * On name conflict: first executor wins (silent).
 */
export function mergeToolExecutors(executors: readonly ToolExecutor[]): CompositeToolExecutor {
  async function buildIndex(composite: CompositeToolExecutor): Promise<Map<string, ToolExecutor>> {
    const cached = indexCacheStore.get(composite);
    if (cached !== undefined) return cached;
    const idx = new Map<string, ToolExecutor>();
    for (const executor of executors) {
      const tools = await executor.listTools();
      for (const tool of tools) {
        if (idx.has(tool.name)) {
          continue;
        }
        idx.set(tool.name, executor);
      }
    }
    indexCacheStore.set(composite, idx);
    return idx;
  }

  const composite: CompositeToolExecutor = {
    executors,

    async execute(
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<{ ok: boolean; output: string }> {
      const idx = await buildIndex(composite);
      const executor = idx.get(toolName);
      if (executor === undefined) {
        return {
          ok: false,
          output: `No executor found for tool: "${toolName}". Available: [${[...idx.keys()].join(", ")}]`,
        };
      }
      return executor.execute(toolName, args);
    },

    async listTools(): Promise<ToolSchema[]> {
      const all: ToolSchema[] = [];
      const idx = new Map<string, ToolExecutor>();
      for (const executor of executors) {
        const tools = await executor.listTools();
        for (const tool of tools) {
          all.push(tool);
          if (!idx.has(tool.name)) {
            idx.set(tool.name, executor);
          }
        }
      }
      indexCacheStore.set(composite, idx);
      return all;
    },
  };

  indexCacheStore.set(composite, undefined);
  return composite;
}

/**
 * Invalidate the cached tool index (e.g., after adding new MCP servers at runtime).
 */
export function invalidateToolIndex(composite: CompositeToolExecutor): void {
  indexCacheStore.set(composite, undefined);
}
