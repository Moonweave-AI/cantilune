import { spawn } from "node:child_process";
import type { ShellConfig } from "../types.js";
import { DEFAULT_MAX_OUTPUT_SIZE, DEFAULT_SHELL_TIMEOUT_MS } from "../types.js";
import { checkCommand } from "./commandSandbox.js";

export interface RunCommandArgs {
  readonly command: string;
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly timeoutMs?: number;
}

export async function runCommand(
  args: RunCommandArgs,
  config: ShellConfig,
  defaultCwd: string,
): Promise<string> {
  const check = checkCommand(args.command, config);
  if (!check.allowed) {
    throw new Error(check.reason ?? "Command not allowed");
  }

  const timeoutMs = args.timeoutMs ?? config.timeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS;
  const maxOutputSize = config.maxOutputSize ?? DEFAULT_MAX_OUTPUT_SIZE;
  const cwd = args.cwd ?? defaultCwd;

  return new Promise((resolve, reject) => {
    const child = spawn(args.command, {
      cwd,
      env: args.env ? { ...process.env, ...args.env } : process.env,
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout = appendWithLimit(stdout, String(chunk), maxOutputSize);
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = appendWithLimit(stderr, String(chunk), maxOutputSize);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
        return;
      }

      const output = formatOutput(stdout, stderr, code);
      if (code !== 0) {
        reject(new Error(output));
      } else {
        resolve(output);
      }
    });
  });
}

function appendWithLimit(current: string, chunk: string, maxSize: number): string {
  const combined = current + chunk;
  if (combined.length <= maxSize) {
    return combined;
  }
  return combined.slice(0, maxSize) + "\n...(output truncated)";
}

function formatOutput(stdout: string, stderr: string, code: number | null): string {
  const parts: string[] = [];
  if (stdout.length > 0) {
    parts.push(stdout.trimEnd());
  }
  if (stderr.length > 0) {
    parts.push(`[stderr]\n${stderr.trimEnd()}`);
  }
  if (code !== null && code !== 0) {
    parts.push(`[exit code: ${code}]`);
  }
  return parts.join("\n");
}

export const runCommandSchema = {
  name: "shell_run_command",
  description: "Execute a shell command and capture stdout/stderr.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      cwd: { type: "string", description: "Working directory for the command" },
      env: { type: "object", description: "Additional environment variables" },
      timeoutMs: { type: "number", description: "Timeout in milliseconds" },
    },
    required: ["command"],
  },
} as const;
