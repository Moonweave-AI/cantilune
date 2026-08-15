import { readFile as fsReadFile, writeFile as fsWriteFile } from "node:fs/promises";

export interface EditFileArgs {
  readonly path: string;
  readonly oldString: string;
  readonly newString: string;
  readonly replaceAll?: boolean;
}

export async function editFile(resolvedPath: string, args: EditFileArgs): Promise<string> {
  const content = await fsReadFile(resolvedPath, "utf8");
  const occurrences = countOccurrences(content, args.oldString);

  if (occurrences === 0) {
    throw new Error(`oldString not found in ${args.path}`);
  }

  if (args.replaceAll) {
    const updated = content.split(args.oldString).join(args.newString);
    await fsWriteFile(resolvedPath, updated, "utf8");
    return `Replaced ${occurrences} occurrence(s) in ${args.path}`;
  }

  if (occurrences > 1) {
    throw new Error(
      `oldString is not unique in ${args.path} (${occurrences} matches). Use replaceAll or provide a unique oldString.`,
    );
  }

  const updated = content.replace(args.oldString, args.newString);
  await fsWriteFile(resolvedPath, updated, "utf8");
  return `Replaced 1 occurrence in ${args.path}`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }
  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count++;
    index += needle.length;
  }
  return count;
}

export const editFileSchema = {
  name: "filesystem_edit_file",
  description:
    "Search and replace text in a file. Fails if oldString is not unique unless replaceAll is true.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path within the filesystem root" },
      oldString: { type: "string", description: "Text to find" },
      newString: { type: "string", description: "Replacement text" },
      replaceAll: { type: "boolean", description: "Replace all occurrences" },
    },
    required: ["path", "oldString", "newString"],
  },
} as const;
