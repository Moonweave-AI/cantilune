import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface ListDirectoryArgs {
  readonly path: string;
}

export async function listDirectory(
  resolvedPath: string,
  args: ListDirectoryArgs,
): Promise<string> {
  const dirStat = await stat(resolvedPath);
  if (!dirStat.isDirectory()) {
    throw new Error(`Not a directory: ${args.path}`);
  }

  const entries = await readdir(resolvedPath, { withFileTypes: true });
  const lines: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(resolvedPath, entry.name);
    if (entry.isDirectory()) {
      lines.push(`[dir]  ${entry.name}/`);
    } else if (entry.isFile()) {
      const entryStat = await stat(entryPath);
      lines.push(`[file] ${entry.name} (${entryStat.size} bytes)`);
    } else {
      lines.push(`[other] ${entry.name}`);
    }
  }

  if (lines.length === 0) {
    return `(empty directory: ${args.path})`;
  }

  return lines.join("\n");
}

export const listDirectorySchema = {
  name: "filesystem_list_directory",
  description: "List directory contents with file/directory markers and sizes.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative directory path within the filesystem root" },
    },
    required: ["path"],
  },
} as const;
