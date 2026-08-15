import { readFile as fsReadFile, stat } from "node:fs/promises";

export interface ReadFileArgs {
  readonly path: string;
  readonly offset?: number;
  readonly limit?: number;
}

export async function readFile(
  resolvedPath: string,
  args: ReadFileArgs,
  maxFileSize: number,
): Promise<string> {
  const fileStat = await stat(resolvedPath);
  if (!fileStat.isFile()) {
    throw new Error(`Not a file: ${args.path}`);
  }
  if (fileStat.size > maxFileSize) {
    throw new Error(`File exceeds max size (${maxFileSize} bytes): ${args.path}`);
  }

  const content = await fsReadFile(resolvedPath, "utf8");
  const lines = content.split(/\r?\n/);

  const offset = args.offset ?? 1;
  if (offset < 1) {
    throw new Error("offset must be >= 1");
  }

  const startIndex = offset - 1;
  const endIndex = args.limit !== undefined ? startIndex + args.limit : lines.length;
  const selected = lines.slice(startIndex, endIndex);

  return selected.map((line, index) => `${startIndex + index + 1}|${line}`).join("\n");
}

export const readFileSchema = {
  name: "filesystem_read_file",
  description:
    "Read file contents with optional line range (1-based offset/limit). Returns LINE_NUMBER|LINE_CONTENT format.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path within the filesystem root" },
      offset: { type: "number", description: "Starting line number (1-based)" },
      limit: { type: "number", description: "Maximum number of lines to read" },
    },
    required: ["path"],
  },
} as const;
