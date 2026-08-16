import type { OsSandbox } from "./sandbox/osSandbox.js";

export type SandboxMode = "required" | "off";

export const DEFAULT_SANDBOX_MODE: SandboxMode = "required";

export interface ToolSetConfig {
  readonly workingDirectory: string;
  readonly filesystem?: FilesystemConfig;
  readonly shell?: ShellConfig;
  readonly web?: WebConfig;
  readonly mcp?: McpConfig[];
  /** Production default is `required` (ADR-0024). Tests may pass `off`. */
  readonly sandbox?: SandboxMode;
  /** Injected sandbox (unit tests). Ignored when `sandbox === "off"`. */
  readonly osSandbox?: OsSandbox;
}

export interface FilesystemConfig {
  readonly enabled: boolean;
  readonly rootDir?: string;
  readonly maxFileSize?: number;
}

export interface ShellConfig {
  readonly enabled: boolean;
  readonly allowList?: string[];
  readonly denyList?: string[];
  readonly timeoutMs?: number;
  readonly maxOutputSize?: number;
  readonly sandbox?: SandboxMode;
  readonly osSandbox?: OsSandbox;
}

export interface WebConfig {
  readonly enabled: boolean;
  readonly searchProvider?: "tavily" | "serper" | "brave" | "none";
  readonly searchApiKey?: string;
  readonly timeoutMs?: number;
  readonly maxResponseSize?: number;
}

export interface McpConfig {
  readonly name: string;
  readonly command: string;
  readonly args?: string[];
  readonly env?: Record<string, string>;
  readonly sandbox?: SandboxMode;
  readonly osSandbox?: OsSandbox;
}

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const DEFAULT_SHELL_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_OUTPUT_SIZE = 100 * 1024;
export const DEFAULT_WEB_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RESPONSE_SIZE = 1024 * 1024;
