import { mkdtemp, rm, symlink, writeFile as fsWriteFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editFile } from "../../src/filesystem/editFile.js";
import { createFilesystemExecutor } from "../../src/filesystem/filesystemExecutor.js";
import { listDirectory } from "../../src/filesystem/listDirectory.js";
import { readFile } from "../../src/filesystem/readFile.js";
import { searchContent } from "../../src/filesystem/searchContent.js";
import { searchFiles } from "../../src/filesystem/searchFiles.js";

describe("filesystem edge cases", () => {
  let tempDir: string;
  let executor: ReturnType<typeof createFilesystemExecutor>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tools-fs-edge-"));
    executor = createFilesystemExecutor({ enabled: true, rootDir: tempDir, maxFileSize: 64 });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("editFile supports replaceAll and rejects missing oldString", async () => {
    const filePath = path.join(tempDir, "replace.txt");
    await fsWriteFile(filePath, "foo bar foo", "utf8");

    const replaced = await editFile(filePath, {
      path: "replace.txt",
      oldString: "foo",
      newString: "baz",
      replaceAll: true,
    });
    expect(replaced).toContain("2 occurrence");

    await expect(
      editFile(filePath, { path: "replace.txt", oldString: "missing", newString: "x" }),
    ).rejects.toThrow("oldString not found");
  });

  it("readFile rejects directories, oversized files, and invalid offset", async () => {
    await expect(readFile(tempDir, { path: "." }, 1024)).rejects.toThrow("Not a file");

    const bigPath = path.join(tempDir, "big.txt");
    await fsWriteFile(bigPath, "0123456789", "utf8");
    await expect(readFile(bigPath, { path: "big.txt" }, 5)).rejects.toThrow("exceeds max size");

    const smallPath = path.join(tempDir, "small.txt");
    await fsWriteFile(smallPath, "line\n", "utf8");
    await expect(readFile(smallPath, { path: "small.txt", offset: 0 }, 64)).rejects.toThrow(
      "offset must be >= 1",
    );
  });

  it("listDirectory handles empty, non-directory, and other entry types", async () => {
    const emptyDir = path.join(tempDir, "empty");
    await fsWriteFile(path.join(tempDir, "file.txt"), "x", "utf8");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(emptyDir);

    const emptyOutput = await listDirectory(emptyDir, { path: "empty" });
    expect(emptyOutput).toContain("(empty directory");

    await expect(
      listDirectory(path.join(tempDir, "file.txt"), { path: "file.txt" }),
    ).rejects.toThrow("Not a directory");

    const linkPath = path.join(tempDir, "link-target");
    await fsWriteFile(linkPath, "target", "utf8");
    const linkName = path.join(tempDir, "my-link");
    try {
      await symlink(linkPath, linkName);
      const output = await listDirectory(tempDir, { path: "." });
      expect(output).toMatch(/\[other\] my-link|\[file\] my-link/);
    } catch {
      // symlinks may be unavailable on some platforms
    }
  });

  it("searchFiles returns message when nothing matches", async () => {
    const output = await searchFiles(tempDir, { pattern: "*.missing" });
    expect(output).toBe("No files matched.");
  });

  it("searchContent respects maxResults and reports no matches", async () => {
    await fsWriteFile(path.join(tempDir, "one.txt"), "alpha", "utf8");
    await fsWriteFile(path.join(tempDir, "two.txt"), "beta", "utf8");

    const limited = await searchContent(tempDir, { pattern: "a", maxResults: 1 }, 1024);
    expect(limited.split("\n")).toHaveLength(1);

    const none = await searchContent(tempDir, { pattern: "zzz", maxResults: 5 }, 1024);
    expect(none).toBe("No matches found.");
  });

  it("searchContent skips oversized files", async () => {
    const bigFile = path.join(tempDir, "huge.txt");
    await fsWriteFile(bigFile, "needle in huge file", "utf8");

    const output = await searchContent(tempDir, { pattern: "needle", maxResults: 10 }, 1);
    expect(output).toBe("No matches found.");
  });

  it("filesystem executor validates tool arguments and unknown tools", async () => {
    const unknown = await executor.execute("filesystem_unknown", {});
    expect(unknown.ok).toBe(false);
    expect(unknown.output).toContain("Unknown filesystem tool");

    const badPath = await executor.execute("filesystem_read_file", { path: 1 });
    expect(badPath.output).toContain("Expected string argument: path");

    const badOffset = await executor.execute("filesystem_read_file", {
      path: "x.txt",
      offset: "1",
    });
    expect(badOffset.output).toContain("Expected number argument: offset");

    const badReplaceAll = await executor.execute("filesystem_edit_file", {
      path: "x.txt",
      oldString: "a",
      newString: "b",
      replaceAll: "yes",
    });
    expect(badReplaceAll.output).toContain("Expected boolean argument: replaceAll");
  });

  it("filesystem executor passes optional directory and filePattern args", async () => {
    await executor.execute("filesystem_write_file", {
      path: "src/item.ts",
      content: "export const value = 1;",
    });

    const files = await executor.execute("filesystem_search_files", {
      pattern: "*.ts",
      directory: "src",
    });
    expect(files.ok).toBe(true);
    expect(files.output).toContain("item.ts");

    const content = await executor.execute("filesystem_search_content", {
      pattern: "value",
      directory: "src",
      filePattern: "*.ts",
      maxResults: 5,
    });
    expect(content.ok).toBe(true);
    expect(content.output).toContain("item.ts:1:");
  });
});
