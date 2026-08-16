/**
 * TUI tool injection: filesystem/shell/web from cwd, MCP from CliConfig
 * (stdio or HTTP). Hot-attach still requires epoch admission (ADR-0026).
 */
import {
  createToolSet,
  type McpConfig,
  type SandboxMode,
  type ToolSet,
  type ToolSetConfig,
} from "@cantilune/tools";

export interface CliToolSetInput {
  readonly workingDirectory: string;
  readonly mcpServers?: readonly string[];
  readonly searchProvider?: "tavily" | "serper" | "brave" | "none";
  /** Production omits this so `createToolSet` defaults to `required`. */
  readonly sandbox?: SandboxMode;
}

export interface ParsedMcpServer {
  readonly spec: string;
  readonly config?: McpConfig;
  readonly rejected?: string;
}

function httpMcpName(url: string, explicit?: string): string {
  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }
  try {
    const host = new URL(url).hostname;
    return host.length > 0 ? host : "http-mcp";
  } catch {
    return "http-mcp";
  }
}

export function parseMcpServerSpec(spec: string): ParsedMcpServer {
  const trimmed = spec.trim();
  const eq = trimmed.indexOf("=");
  const named = eq > 0 ? { name: trimmed.slice(0, eq), rest: trimmed.slice(eq + 1) } : undefined;
  const commandText = (named?.rest ?? trimmed).trim();
  if (commandText.startsWith("http://") || commandText.startsWith("https://")) {
    return {
      spec: trimmed,
      config: {
        name: httpMcpName(commandText, named?.name),
        command: commandText,
      },
    };
  }
  const tokens = commandText.split(/\s+/).filter((part) => part.length > 0);
  const command = tokens[0];
  if (command === undefined) {
    return { spec: trimmed, rejected: "empty MCP command" };
  }
  return {
    spec: trimmed,
    config: {
      name: named?.name ?? command,
      command,
      ...(tokens.length > 1 ? { args: tokens.slice(1) } : {}),
    },
  };
}

export function createCliToolSet(input: CliToolSetInput): {
  readonly tools: ToolSet;
  readonly mcp: readonly ParsedMcpServer[];
} {
  const mcp = (input.mcpServers ?? []).map(parseMcpServerSpec);
  const attached = mcp
    .map((entry) => entry.config)
    .filter((config): config is McpConfig => config !== undefined);
  const config: ToolSetConfig = {
    workingDirectory: input.workingDirectory,
    filesystem: { enabled: true, rootDir: input.workingDirectory },
    shell: { enabled: true },
    web: {
      enabled: true,
      ...(input.searchProvider !== undefined ? { searchProvider: input.searchProvider } : {}),
    },
    ...(attached.length > 0 ? { mcp: attached } : {}),
    ...(input.sandbox !== undefined ? { sandbox: input.sandbox } : {}),
  };
  return { tools: createToolSet(config), mcp };
}
