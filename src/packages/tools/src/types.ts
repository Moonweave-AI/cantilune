export interface ToolSetConfig {
  readonly workingDirectory: string;
  readonly filesystem?: FilesystemConfig;
  readonly shell?: ShellConfig;
  readonly web?: WebConfig;
  readonly mcp?: McpConfig[];
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
}

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const DEFAULT_SHELL_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_OUTPUT_SIZE = 100 * 1024;
export const DEFAULT_WEB_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RESPONSE_SIZE = 1024 * 1024;
