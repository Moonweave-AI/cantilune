import type { ToolExecutor, ToolExecutionTier, ToolInvocationKey, ToolReconcileResult, ToolSchema } from "@cantilune/syscall";
import type { FilesystemConfig } from "../types.js";
import { DEFAULT_MAX_FILE_SIZE } from "../types.js";
import { editFile, editFileSchema } from "./editFile.js";
import { listDirectory, listDirectorySchema } from "./listDirectory.js";
import { resolveSafePath } from "./pathUtils.js";
import { readFile, readFileSchema } from "./readFile.js";
import { searchContent, searchContentSchema } from "./searchContent.js";
import { searchFiles, searchFilesSchema } from "./searchFiles.js";
import { writeFile, writeFileSchema } from "./writeFile.js";

const FILESYSTEM_SCHEMAS: ToolSchema[] = [
  readFileSchema,
  writeFileSchema,
  editFileSchema,
  listDirectorySchema,
  searchFilesSchema,
  searchContentSchema,
];

/**
 * Per-tool side-effect tier (ADR-0016 §3).
 * - read/list/search tools → Tier 0 (read): no side effect; re-dispatch is safe.
 * - write_file → Tier 1 (idempotent): writing the same content is a no-op; the
 *   executor reconciles by reading the file back and confirming the content.
 * - edit_file → Tier 2 (non-idempotent): an edit replaces oldString with
 *   newString; re-dispatching after the edit landed fails (oldString is gone),
 *   so the run must not re-dispatch and reports ambiguous if interrupted.
 */
const READ_TOOLS = new Set<string>([
  "filesystem_read_file",
  "filesystem_list_directory",
  "filesystem_search_files",
  "filesystem_search_content",
]);

type ExecuteResult = Promise<{ ok: boolean; output: string }>;

export function createFilesystemExecutor(
  config: FilesystemConfig & { readonly rootDir: string },
): ToolExecutor {
  const rootDir = config.rootDir;
  const maxFileSize = config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

  return {
    // Fail-safe default for any tool this executor does not explicitly classify.
    tier: "non-idempotent",

    tierFor(toolName: string): ToolExecutionTier | undefined {
      if (READ_TOOLS.has(toolName)) return "read";
      if (toolName === "filesystem_write_file") return "idempotent";
      if (toolName === "filesystem_edit_file") return "non-idempotent";
      return undefined;
    },

    async listTools(): Promise<ToolSchema[]> {
      return FILESYSTEM_SCHEMAS;
    },

    async execute(
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<{ ok: boolean; output: string }> {
      try {
        switch (toolName) {
          case "filesystem_read_file":
            return await executeReadFile(rootDir, maxFileSize, args);
          case "filesystem_write_file":
            return await executeWriteFile(rootDir, args);
          case "filesystem_edit_file":
            return await executeEditFile(rootDir, args);
          case "filesystem_list_directory":
            return await executeListDirectory(rootDir, args);
          case "filesystem_search_files":
            return await executeSearchFiles(rootDir, args);
          case "filesystem_search_content":
            return await executeSearchContent(rootDir, maxFileSize, args);
          default:
            return { ok: false, output: `Unknown filesystem tool: ${toolName}` };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, output: message };
      }
    },

    /**
     * Reconcile a `filesystem_write_file` invocation (ADR-0016 §4). A write_file
     * is idempotent by content: writing the same content to the same path is a
     * no-op, so a re-dispatch after a crash is always safe. The idempotency key
     * (by ADR-0016 design) carries only a digest of the args, not the args
     * themselves, so the executor cannot re-derive the target path/content from
     * the key to confirm "already written." Therefore reconcile reports
     * `unknown`, and the run re-dispatches — which is correct and safe for an
     * idempotent write (the re-dispatch overwrites identical content). The Tier
     * 1 declaration still matters: it documents that re-dispatch is safe, in
     * contrast to `filesystem_edit_file` (Tier 2), where re-dispatch is unsafe.
     * Only `filesystem_write_file` reaches this method; other tools resolve to
     * a non-idempotent tier and never call reconcile.
     */
    async reconcile(key: ToolInvocationKey): Promise<ToolReconcileResult> {
      void key;
      return { status: "unknown" };
    },
  };
}

async function executeReadFile(
  rootDir: string,
  maxFileSize: number,
  args: Record<string, unknown>,
): ExecuteResult {
  const pathArg = requireString(args, "path");
  const resolved = resolveSafePath(rootDir, pathArg);
  const output = await readFile(
    resolved,
    {
      path: pathArg,
      ...(args.offset !== undefined ? { offset: requireNumber(args, "offset") } : {}),
      ...(args.limit !== undefined ? { limit: requireNumber(args, "limit") } : {}),
    },
    maxFileSize,
  );
  return { ok: true, output };
}

async function executeWriteFile(rootDir: string, args: Record<string, unknown>): ExecuteResult {
  const pathArg = requireString(args, "path");
  const content = requireString(args, "content");
  const resolved = resolveSafePath(rootDir, pathArg);
  const output = await writeFile(resolved, { path: pathArg, content });
  return { ok: true, output };
}

async function executeEditFile(rootDir: string, args: Record<string, unknown>): ExecuteResult {
  const pathArg = requireString(args, "path");
  const oldString = requireString(args, "oldString");
  const newString = requireString(args, "newString");
  const resolved = resolveSafePath(rootDir, pathArg);
  const output = await editFile(resolved, {
    path: pathArg,
    oldString,
    newString,
    ...(args.replaceAll !== undefined ? { replaceAll: requireBoolean(args, "replaceAll") } : {}),
  });
  return { ok: true, output };
}

async function executeListDirectory(rootDir: string, args: Record<string, unknown>): ExecuteResult {
  const pathArg = requireString(args, "path");
  const resolved = resolveSafePath(rootDir, pathArg);
  const output = await listDirectory(resolved, { path: pathArg });
  return { ok: true, output };
}

async function executeSearchFiles(rootDir: string, args: Record<string, unknown>): ExecuteResult {
  const pattern = requireString(args, "pattern");
  const output = await searchFiles(rootDir, {
    pattern,
    ...(args.directory !== undefined ? { directory: requireString(args, "directory") } : {}),
  });
  return { ok: true, output };
}

async function executeSearchContent(
  rootDir: string,
  maxFileSize: number,
  args: Record<string, unknown>,
): ExecuteResult {
  const pattern = requireString(args, "pattern");
  const output = await searchContent(
    rootDir,
    {
      pattern,
      ...(args.directory !== undefined ? { directory: requireString(args, "directory") } : {}),
      ...(args.filePattern !== undefined
        ? { filePattern: requireString(args, "filePattern") }
        : {}),
      ...(args.maxResults !== undefined ? { maxResults: requireNumber(args, "maxResults") } : {}),
    },
    maxFileSize,
  );
  return { ok: true, output };
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

function requireBoolean(args: Record<string, unknown>, key: string): boolean {
  const value = args[key];
  if (typeof value !== "boolean") {
    throw new TypeError(`Expected boolean argument: ${key}`);
  }
  return value;
}
