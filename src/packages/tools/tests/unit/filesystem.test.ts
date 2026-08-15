import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemExecutor } from "../../src/filesystem/filesystemExecutor.js";

describe("filesystem tools", () => {
  let tempDir: string;
  let executor: ReturnType<typeof createFilesystemExecutor>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tools-fs-"));
    executor = createFilesystemExecutor({
      enabled: true,
      rootDir: tempDir,
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writeFile, readFile, editFile, listDirectory", async () => {
    const writeResult = await executor.execute("filesystem_write_file", {
      path: "subdir/hello.txt",
      content: "line one\nline two\nline three",
    });
    expect(writeResult.ok).toBe(true);

    const readResult = await executor.execute("filesystem_read_file", {
      path: "subdir/hello.txt",
      offset: 2,
      limit: 1,
    });
    expect(readResult.ok).toBe(true);
    expect(readResult.output).toBe("2|line two");

    const editResult = await executor.execute("filesystem_edit_file", {
      path: "subdir/hello.txt",
      oldString: "line two",
      newString: "line TWO",
    });
    expect(editResult.ok).toBe(true);

    const listResult = await executor.execute("filesystem_list_directory", {
      path: ".",
    });
    expect(listResult.ok).toBe(true);
    expect(listResult.output).toContain("[dir]  subdir/");
  });

  it("editFile fails when oldString is not unique", async () => {
    await executor.execute("filesystem_write_file", {
      path: "dup.txt",
      content: "foo bar foo",
    });

    const result = await executor.execute("filesystem_edit_file", {
      path: "dup.txt",
      oldString: "foo",
      newString: "baz",
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("not unique");
  });

  it("searchFiles and searchContent", async () => {
    await executor.execute("filesystem_write_file", {
      path: "alpha.ts",
      content: "const alpha = 1;",
    });
    await executor.execute("filesystem_write_file", {
      path: "beta.js",
      content: "const beta = 2;",
    });

    const filesResult = await executor.execute("filesystem_search_files", {
      pattern: "*.ts",
    });
    expect(filesResult.ok).toBe(true);
    expect(filesResult.output).toContain("alpha.ts");

    const contentResult = await executor.execute("filesystem_search_content", {
      pattern: "beta",
      filePattern: "*.js",
    });
    expect(contentResult.ok).toBe(true);
    expect(contentResult.output).toContain("beta.js:1:");
  });

  it("rejects paths outside root", async () => {
    const result = await executor.execute("filesystem_read_file", {
      path: "../outside.txt",
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("outside allowed root");
  });
});
