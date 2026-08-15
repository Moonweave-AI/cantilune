import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFilesystemExecutor } from "../../src/filesystem/filesystemExecutor.js";
import { createShellExecutor } from "../../src/shell/shellExecutor.js";
import { createWebExecutor } from "../../src/web/webExecutor.js";

vi.mock("../../src/shell/runCommand.js", () => ({
  runCommand: vi.fn(),
  runCommandSchema: { name: "shell_run_command" },
}));

import { runCommand } from "../../src/shell/runCommand.js";

describe("tool contract negative inputs", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tools-contract-"));
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("filesystem rejects missing required fields", async () => {
    const fs = createFilesystemExecutor({ enabled: true, rootDir: tempDir });
    const write = await fs.execute("filesystem_write_file", { path: "a.txt" });
    expect(write.ok).toBe(false);
    expect(write.output).toContain("Expected string argument: content");
  });

  it("shell rejects sandbox-blocked commands via runCommand", async () => {
    vi.mocked(runCommand).mockRejectedValue(new Error("Command denied by denyList: rm -rf /"));
    const shell = createShellExecutor({ enabled: true, workingDirectory: tempDir });
    const result = await shell.execute("shell_run_command", { command: "rm -rf /" });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("denyList");
  });

  it("web propagates fetch HTTP failures through executor", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => "text/plain" },
      text: async () => "error",
      body: null,
    } as unknown as Response);

    const web = createWebExecutor({ enabled: true });
    const result = await web.execute("web_fetch", { url: "https://example.com/broken" });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("HTTP 500");
  });

  it("web_search returns failure message without throwing", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network unavailable"));
    const web = createWebExecutor({ enabled: true, searchProvider: "tavily", searchApiKey: "key" });
    const result = await web.execute("web_search", { query: "contract test" });
    expect(result.ok).toBe(true);
    expect(result.output).toContain("Web search failed");
  });
});
