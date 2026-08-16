import type { ToolExecutor, ToolSchema } from "@cantilune/syscall";
import { DEFAULT_SANDBOX_MODE, type ShellConfig } from "../types.js";
import { createOsSandbox } from "../sandbox/osSandbox.js";
import { runCommand, runCommandSchema } from "./runCommand.js";

const SHELL_SCHEMAS: ToolSchema[] = [runCommandSchema];

export function createShellExecutor(
  config: ShellConfig & { readonly workingDirectory: string },
): ToolExecutor {
  const sandboxMode = config.sandbox ?? DEFAULT_SANDBOX_MODE;
  const osSandbox = sandboxMode === "off" ? undefined : (config.osSandbox ?? createOsSandbox());
  const resolved: ShellConfig & { readonly workingDirectory: string } = {
    ...config,
    sandbox: sandboxMode,
    ...(osSandbox !== undefined ? { osSandbox } : {}),
  };
  const workingDirectory = config.workingDirectory;

  return {
    // ADR-0016 §3: shell commands are non-idempotent side effects with no
    // outcome-query. After a crash with a dispatched-but-incomplete journal
    // entry the run reports ambiguous rather than re-dispatching.
    tier: "non-idempotent",

    async listTools(): Promise<ToolSchema[]> {
      return SHELL_SCHEMAS;
    },

    async execute(
      toolName: string,
      args: Record<string, unknown>,
      options?: { readonly signal?: AbortSignal },
    ): Promise<{ ok: boolean; output: string }> {
      if (toolName !== "shell_run_command") {
        return { ok: false, output: `Unknown shell tool: ${toolName}` };
      }
      if (options?.signal?.aborted === true) {
        return { ok: false, output: "skipped: aborted before shell dispatch" };
      }

      try {
        const command = requireString(args, "command");
        const output = await runCommand(
          {
            command,
            ...(args.cwd !== undefined ? { cwd: requireString(args, "cwd") } : {}),
            ...(args.env !== undefined ? { env: requireStringRecord(args, "env") } : {}),
            ...(args.timeoutMs !== undefined
              ? { timeoutMs: requireNumber(args, "timeoutMs") }
              : {}),
            ...(options?.signal !== undefined ? { signal: options.signal } : {}),
          },
          resolved,
          workingDirectory,
        );
        return { ok: true, output };
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

function requireStringRecord(args: Record<string, unknown>, key: string): Record<string, string> {
  const value = args[key];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected object argument: ${key}`);
  }
  const result: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      throw new TypeError(`Expected string values in ${key}`);
    }
    result[entryKey] = entryValue;
  }
  return result;
}
