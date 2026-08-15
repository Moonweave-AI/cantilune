import { readFile as fsReadFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { matchGlobPattern } from "./pathUtils.js";

export interface SearchContentArgs {
  readonly pattern: string;
  readonly directory?: string;
  readonly filePattern?: string;
  readonly maxResults?: number;
}

interface ContentMatch {
  readonly file: string;
  readonly lineNumber: number;
  readonly line: string;
}

export async function searchContent(
  rootDir: string,
  args: SearchContentArgs,
  maxFileSize: number,
): Promise<string> {
  const searchRoot = path.resolve(rootDir, args.directory ?? ".");
  const regex = new RegExp(args.pattern);
  const filePattern = args.filePattern ?? "*";
  const maxResults = args.maxResults ?? 100;
  const matches: ContentMatch[] = [];

  await searchDirectory(searchRoot, rootDir, regex, filePattern, maxFileSize, matches, maxResults);

  if (matches.length === 0) {
    return "No matches found.";
  }

  return matches.map((match) => `${match.file}:${match.lineNumber}: ${match.line}`).join("\n");
}

async function searchDirectory(
  currentDir: string,
  rootDir: string,
  regex: RegExp,
  filePattern: string,
  maxFileSize: number,
  matches: ContentMatch[],
  maxResults: number,
): Promise<void> {
  if (matches.length >= maxResults) {
    return;
  }

  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (matches.length >= maxResults) {
      return;
    }

    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await searchDirectory(
        fullPath,
        rootDir,
        regex,
        filePattern,
        maxFileSize,
        matches,
        maxResults,
      );
    } else if (entry.isFile() && matchGlobPattern(entry.name, filePattern)) {
      await searchFile(fullPath, rootDir, regex, maxFileSize, matches, maxResults);
    }
  }
}

async function searchFile(
  fullPath: string,
  rootDir: string,
  regex: RegExp,
  maxFileSize: number,
  matches: ContentMatch[],
  maxResults: number,
): Promise<void> {
  if (matches.length >= maxResults) {
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(fullPath);
  } catch {
    return;
  }

  if (fileStat.size > maxFileSize) {
    return;
  }

  let content: string;
  try {
    content = await fsReadFile(fullPath, "utf8");
  } catch {
    return;
  }

  const relativePath = path.relative(rootDir, fullPath).split(path.sep).join("/");
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    if (matches.length >= maxResults) {
      return;
    }
    const line = lines[i] ?? "";
    if (regex.test(line)) {
      matches.push({ file: relativePath, lineNumber: i + 1, line });
    }
  }
}

export const searchContentSchema = {
  name: "filesystem_search_content",
  description: "Search file contents by regex pattern, returning matching lines with line numbers.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for" },
      directory: { type: "string", description: "Subdirectory to search within (default: root)" },
      filePattern: { type: "string", description: "Glob pattern to filter files (default: *)" },
      maxResults: {
        type: "number",
        description: "Maximum number of matches to return (default: 100)",
      },
    },
    required: ["pattern"],
  },
} as const;
