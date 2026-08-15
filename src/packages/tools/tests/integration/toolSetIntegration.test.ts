import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type * as RunCommandModule from "../../src/shell/runCommand.js";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as mcpBridge from "../../src/mcp/mcpBridge.js";
import { clearMcpDiscoveryCache } from "../../src/mcp/mcpDiscovery.js";
import { createToolSet } from "../../src/createToolSet.js";

vi.mock("../../src/shell/runCommand.js", async (importOriginal) => {
  const original = await importOriginal<typeof RunCommandModule>();
  return {
    ...original,
    runCommand: vi.fn().mockResolvedValue("mocked shell output"),
  };
});

function createIntegrationMockClient(): mcpBridge.McpClient {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    listTools: vi.fn(async () => [
      {
        name: "ping",
        description: "Ping tool",
        inputSchema: { type: "object", properties: {} },
      },
    ]),
    callTool: vi.fn(async () => ({
      content: [{ type: "text", text: "pong from mcp" }],
    })),
  };
}

describe("createToolSet integration", () => {
  let tempDir: string;
  let createClientSpy: MockInstance<typeof mcpBridge.createMcpClient>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tools-int-"));
    clearMcpDiscoveryCache();
    createClientSpy = vi
      .spyOn(mcpBridge, "createMcpClient")
      .mockReturnValue(createIntegrationMockClient());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "text/plain" },
        text: async () => "integration fetch body",
        body: null,
      }),
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    clearMcpDiscoveryCache();
    createClientSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("routes execute to correct executor after listTools warms cache", async () => {
    const toolSet = createToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
      shell: { enabled: true },
      web: { enabled: true },
      mcp: [{ name: "srv", command: "node", args: ["mcp.js"] }],
    });

    await toolSet.listTools();

    const shell = await toolSet.execute("shell_run_command", { command: "echo integrated" });
    expect(shell.ok).toBe(true);
    expect(shell.output).toBe("mocked shell output");

    const web = await toolSet.execute("web_fetch", { url: "https://example.com" });
    expect(web.ok).toBe(true);
    expect(web.output).toBe("integration fetch body");

    const mcp = await toolSet.execute("mcp_srv_ping", {});
    expect(mcp.ok).toBe(true);
    expect(mcp.output).toBe("pong from mcp");
  });

  it("lazy-routes tools when execute called before listTools", async () => {
    const toolSet = createToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
    });

    const result = await toolSet.execute("filesystem_write_file", {
      path: "lazy.txt",
      content: "lazy write",
    });
    expect(result.ok).toBe(true);

    const read = await toolSet.execute("filesystem_read_file", { path: "lazy.txt" });
    expect(read.ok).toBe(true);
    expect(read.output).toContain("lazy write");
  });

  it("uses workingDirectory as filesystem root when rootDir omitted", async () => {
    const toolSet = createToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true },
    });

    const write = await toolSet.execute("filesystem_write_file", {
      path: "root-default.txt",
      content: "default root",
    });
    expect(write.ok).toBe(true);
  });
});
