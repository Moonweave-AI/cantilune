import { mkdir, writeFile as fsWriteFile } from "node:fs/promises";
import path from "node:path";

export interface WriteFileArgs {
  readonly path: string;
  readonly content: string;
}

export async function writeFile(resolvedPath: string, args: WriteFileArgs): Promise<string> {
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await fsWriteFile(resolvedPath, args.content, "utf8");
  return `Wrote ${args.content.length} bytes to ${args.path}`;
}

export const writeFileSchema = {
  name: "filesystem_write_file",
  description: "Write or overwrite a file. Creates parent directories as needed.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path within the filesystem root" },
      content: { type: "string", description: "File content to write" },
    },
    required: ["path", "content"],
  },
} as const;
