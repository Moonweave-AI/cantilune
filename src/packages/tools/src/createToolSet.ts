import type {
  ToolExecutionTier,
  ToolExecutor,
  ToolInvocationKey,
  ToolReconcileResult,
  ToolSchema,
} from "@cantilune/syscall";
import { createFilesystemExecutor } from "./filesystem/filesystemExecutor.js";
import { applyMcpAttach, type McpAttachInput, type McpToolSurface } from "./mcp/mcpEpochAttach.js";
import { createMcpExecutor, type McpExecutor } from "./mcp/mcpExecutor.js";
import { createOsSandbox, type OsSandbox } from "./sandbox/osSandbox.js";
import { createShellExecutor } from "./shell/shellExecutor.js";
import { DEFAULT_SANDBOX_MODE, type ToolSetConfig } from "./types.js";
import { createWebExecutor } from "./web/webExecutor.js";

export interface ToolSet extends ToolExecutor {
  applyMcpSurface(input: McpAttachInput): McpToolSurface;
}

export function createToolSet(config: ToolSetConfig): ToolSet {
  const sandboxMode = config.sandbox ?? DEFAULT_SANDBOX_MODE;
  const osSandbox: OsSandbox | undefined =
    sandboxMode === "off" ? undefined : (config.osSandbox ?? createOsSandbox());

  const stable: ToolExecutor[] = [];
  const toolRoutes = new Map<string, ToolExecutor>();

  if (config.filesystem?.enabled) {
    const rootDir = config.filesystem.rootDir ?? config.workingDirectory;
    stable.push(createFilesystemExecutor({ ...config.filesystem, rootDir }));
  }

  if (config.shell?.enabled) {
    stable.push(
      createShellExecutor({
        ...config.shell,
        workingDirectory: config.workingDirectory,
        sandbox: sandboxMode,
        ...(osSandbox !== undefined ? { osSandbox } : {}),
      }),
    );
  }

  if (config.web?.enabled) {
    stable.push(createWebExecutor(config.web));
  }

  let mcpExecutors: McpExecutor[] = (config.mcp ?? []).map((mcpConfig) =>
    createMcpExecutor(mcpConfig, osSandbox),
  );

  function allExecutors(): readonly ToolExecutor[] {
    return [...stable, ...mcpExecutors];
  }

  return {
    // ADR-0016 §3: the composite executor fails safe by default; per-tool tiers
    // are resolved by `tierFor`, which routes to the underlying executor that
    // owns the tool. The composite itself never declares a single tier because
    // it serves mixed-tier tools.
    tier: "non-idempotent",

    applyMcpSurface(input: McpAttachInput): McpToolSurface {
      const surface = applyMcpAttach(input);
      for (const executor of mcpExecutors) {
        executor.dispose?.();
      }
      mcpExecutors = surface.servers.map((server) => createMcpExecutor(server, osSandbox));
      toolRoutes.clear();
      return surface;
    },

    tierFor(toolName: string): ToolExecutionTier | undefined {
      const executor = toolRoutes.get(toolName);
      if (executor === undefined) return undefined;
      return executor.tierFor?.(toolName) ?? executor.tier;
    },

    async listTools(): Promise<ToolSchema[]> {
      const schemas: ToolSchema[] = [];
      for (const executor of allExecutors()) {
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
      options?: { readonly signal?: AbortSignal },
    ): Promise<{ ok: boolean; output: string }> {
      if (options?.signal?.aborted === true) {
        return { ok: false, output: "skipped: aborted before dispatch" };
      }
      let executor = toolRoutes.get(toolName);
      if (executor === undefined) {
        for (const candidate of allExecutors()) {
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

      return executor.execute(toolName, args, options);
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
