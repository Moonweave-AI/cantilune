import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHostToolSet } from "../support/hostToolSet.js";

describe("toolSet system scenarios", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tools-system-"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => "<html><h1>System</h1><p>Check</p></html>",
        body: null,
      }),
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("supports filesystem-only deployment with full CRUD-like workflow", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
    });

    const tools = await toolSet.listTools();
    expect(tools).toHaveLength(6);

    await toolSet.execute("filesystem_write_file", {
      path: "workflow/readme.md",
      content: "# Title\nbody line",
    });
    await toolSet.execute("filesystem_edit_file", {
      path: "workflow/readme.md",
      oldString: "body line",
      newString: "updated body",
    });

    const read = await toolSet.execute("filesystem_read_file", {
      path: "workflow/readme.md",
    });
    expect(read.output).toContain("updated body");

    const listed = await toolSet.execute("filesystem_list_directory", { path: "workflow" });
    expect(listed.output).toContain("readme.md");
  });

  it("supports web-only deployment for fetch workflow", async () => {
    const toolSet = createHostToolSet({
      workingDirectory: tempDir,
      web: { enabled: true, timeoutMs: 5000 },
    });

    const result = await toolSet.execute("web_fetch", { url: "https://docs.example.com" });
    expect(result.ok).toBe(true);
    expect(result.output).toContain("System");
    expect(result.output).toContain("Check");
  });
});
