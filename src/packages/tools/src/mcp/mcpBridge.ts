import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { McpConfig } from "../types.js";

export interface McpToolSchema {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  readonly content: { type: string; text: string }[];
  readonly isError?: boolean;
}

export interface McpClient {
  connect(): Promise<void>;
  disconnect(): void;
  listTools(): Promise<McpToolSchema[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
}

export interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id?: number;
  readonly result?: unknown;
  readonly error?: { code: number; message: string; data?: unknown };
  readonly method?: string;
}

const DEFAULT_MCP_TIMEOUT_MS = 30_000;

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Parse a single newline-delimited JSON-RPC 2.0 message line.
 * Returns null for empty lines or invalid JSON.
 */
export function parseJsonRpcLine(line: string): JsonRpcResponse | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const rpc = parsed as Record<string, unknown>;
  if (rpc.jsonrpc !== "2.0") {
    return null;
  }

  return parsed as JsonRpcResponse;
}

export function createMcpClient(
  config: McpConfig,
  options?: { readonly timeoutMs?: number },
): McpClient {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_MCP_TIMEOUT_MS;
  let child: ChildProcessWithoutNullStreams | null = null;
  let nextId = 1;
  let buffer = "";
  let connected = false;
  const pending = new Map<number, PendingRequest>();

  function rejectAllPending(message: string): void {
    for (const [id, req] of pending) {
      clearTimeout(req.timer);
      req.reject(new Error(message));
      pending.delete(id);
    }
  }

  function handleLine(line: string): void {
    const message = parseJsonRpcLine(line);
    if (message?.id === undefined) {
      return;
    }

    const req = pending.get(message.id);
    if (req === undefined) {
      return;
    }

    clearTimeout(req.timer);
    pending.delete(message.id);

    if (message.error !== undefined) {
      req.reject(new Error(message.error.message ?? "MCP JSON-RPC error"));
      return;
    }

    req.resolve(message.result);
  }

  function sendRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (child === null || !child.stdin.writable) {
      return Promise.reject(new Error("MCP client not connected"));
    }

    const id = nextId++;
    const payload = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, timeoutMs);

      pending.set(id, { resolve, reject, timer });

      child!.stdin.write(payload, (err) => {
        if (err !== null && err !== undefined) {
          clearTimeout(timer);
          pending.delete(id);
          reject(err);
        }
      });
    });
  }

  return {
    async connect(): Promise<void> {
      if (connected) {
        return;
      }

      child = spawn(config.command, config.args ?? [], {
        env: { ...process.env, ...config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        buffer += chunk;
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          handleLine(line);
          newlineIndex = buffer.indexOf("\n");
        }
      });

      child.on("exit", (code, signal) => {
        connected = false;
        rejectAllPending(
          `MCP server process exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})`,
        );
      });

      child.on("error", (err) => {
        connected = false;
        rejectAllPending(`MCP server process error: ${err.message}`);
      });

      await sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "cantilune-tools", version: "0.0.1" },
      });

      if (child.stdin.writable) {
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
        );
      }

      connected = true;
    },

    disconnect(): void {
      if (child !== null) {
        child.kill();
        child = null;
      }
      connected = false;
      rejectAllPending("MCP client disconnected");
    },

    async listTools(): Promise<McpToolSchema[]> {
      const result = await sendRequest("tools/list", {});
      const tools = (result as { tools?: McpToolSchema[] })?.tools ?? [];
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      }));
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
      const result = await sendRequest("tools/call", { name, arguments: args });
      const typed = result as McpToolResult;
      return {
        content: typed.content ?? [],
        ...(typed.isError !== undefined ? { isError: typed.isError } : {}),
      };
    },
  };
}

export function formatMcpToolResult(result: McpToolResult): string {
  if (result.content.length === 0) {
    return result.isError === true ? "MCP tool returned an error with no content" : "";
  }

  return result.content
    .map((item) => (item.type === "text" ? item.text : `[${item.type}] ${item.text}`))
    .join("\n");
}
