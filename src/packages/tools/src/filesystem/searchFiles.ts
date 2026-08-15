import { readdir } from "node:fs/promises";
import path from "node:path";
import { matchGlobPattern } from "./pathUtils.js";

export interface SearchFilesArgs {
  readonly pattern: string;
  readonly directory?: string;
}

export async function searchFiles(rootDir: string, args: SearchFilesArgs): Promise<string> {
  const searchRoot = path.resolve(rootDir, args.directory ?? ".");
  const matches: string[] = [];

  await walkDirectory(searchRoot, rootDir, args.pattern, matches);

  if (matches.length === 0) {
    return "No files matched.";
  }

  const sorted = [...matches].sort((a, b) => a.localeCompare(b));
  return sorted.join("\n");
}

async function walkDirectory(
  currentDir: string,
  rootDir: string,
  pattern: string,
  matches: string[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, rootDir, pattern, matches);
    } else if (entry.isFile()) {
      const relativePath = path.relative(rootDir, fullPath);
      const normalized = relativePath.split(path.sep).join("/");
      if (matchGlobPattern(entry.name, pattern) || matchGlobPattern(normalized, pattern)) {
        matches.push(normalized);
      }
    }
  }
}

export const searchFilesSchema = {
  name: "filesystem_search_files",
  description: "Search for files by glob pattern within a directory tree.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern (e.g. *.ts, **/*.json)" },
      directory: { type: "string", description: "Subdirectory to search within (default: root)" },
    },
    required: ["pattern"],
  },
} as const;
