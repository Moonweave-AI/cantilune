import type {
  ToolExecutionTier,
  ToolExecutor,
  ToolInvocationKey,
  ToolReconcileResult,
  ToolSchema,
} from "@cantilune/syscall";
import { createFilesystemExecutor } from "./filesystem/filesystemExecutor.js";
import { createMcpExecutor } from "./mcp/mcpExecutor.js";
import { createShellExecutor } from "./shell/shellExecutor.js";
import type { ToolSetConfig } from "./types.js";
import { createWebExecutor } from "./web/webExecutor.js";

export function createToolSet(config: ToolSetConfig): ToolExecutor {
  const executors: ToolExecutor[] = [];
  const toolRoutes = new Map<string, ToolExecutor>();

  if (config.filesystem?.enabled) {
    const rootDir = config.filesystem.rootDir ?? config.workingDirectory;
    const fsExecutor = createFilesystemExecutor({ ...config.filesystem, rootDir });
    executors.push(fsExecutor);
  }

  if (config.shell?.enabled) {
    const shellExecutor = createShellExecutor({
      ...config.shell,
      workingDirectory: config.workingDirectory,
    });
    executors.push(shellExecutor);
  }

  if (config.web?.enabled) {
    const webExecutor = createWebExecutor(config.web);
    executors.push(webExecutor);
  }

  if (config.mcp !== undefined) {
    for (const mcpConfig of config.mcp) {
      executors.push(createMcpExecutor(mcpConfig));
    }
  }

  return {
    // ADR-0016 §3: the composite executor fails safe by default; per-tool tiers
    // are resolved by `tierFor`, which routes to the underlying executor that
    // owns the tool. The composite itself never declares a single tier because
    // it serves mixed-tier tools.
    tier: "non-idempotent",

    tierFor(toolName: string): ToolExecutionTier | undefined {
      const executor = toolRoutes.get(toolName);
      if (executor === undefined) return undefined;
      return executor.tierFor?.(toolName) ?? executor.tier;
    },

    async listTools(): Promise<ToolSchema[]> {
      const schemas: ToolSchema[] = [];
      for (const executor of executors) {
        const tools = await executor.listTools();
        for (const tool of tools) {
          toolRoutes.set(tool.name, executor);
          schemas.push(tool);
        }
      }
      return schemas;
    },

    async execute(
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<{ ok: boolean; output: string }> {
      let executor = toolRoutes.get(toolName);
      if (executor === undefined) {
        for (const candidate of executors) {
          const tools = await candidate.listTools();
          if (tools.some((tool) => tool.name === toolName)) {
            executor = candidate;
            toolRoutes.set(toolName, candidate);
            break;
          }
        }
      }

      if (executor === undefined) {
        return { ok: false, output: `Unknown tool: ${toolName}` };
      }

      return executor.execute(toolName, args);
    },

    async reconcile(key: ToolInvocationKey): Promise<ToolReconcileResult> {
      // Route reconcile to the underlying executor that owns the tool. If the
      // tool's tier is not idempotent the run never reaches this method, but
      // route it anyway so the composite honors the ToolExecutor contract.
      const executor = toolRoutes.get(key.toolName);
      if (executor === undefined || executor.reconcile === undefined) {
        return { status: "unknown" };
      }
      return executor.reconcile(key);
    },
  };
}
