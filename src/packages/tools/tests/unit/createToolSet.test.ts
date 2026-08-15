import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as mcpBridge from "../../src/mcp/mcpBridge.js";
import { clearMcpDiscoveryCache } from "../../src/mcp/mcpDiscovery.js";
import { createToolSet } from "../../src/createToolSet.js";

function createMockClient(): mcpBridge.McpClient {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    listTools: vi.fn(async () => [
      {
        name: "call",
        description: "Proxy call",
        inputSchema: {
          type: "object",
          properties: {
            tool: { type: "string" },
            arguments: { type: "object" },
          },
          required: ["tool"],
        },
      },
    ]),
    callTool: vi.fn(async () => ({ content: [{ type: "text", text: "mcp ok" }] })),
  };
}

describe("createToolSet", () => {
  let tempDir: string;
  let createClientSpy: MockInstance<typeof mcpBridge.createMcpClient>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cantilune-tools-set-"));
    clearMcpDiscoveryCache();
    createClientSpy = vi.spyOn(mcpBridge, "createMcpClient").mockReturnValue(createMockClient());
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    clearMcpDiscoveryCache();
    createClientSpy.mockRestore();
  });

  it("merges enabled executors and routes by tool name", async () => {
    const toolSet = createToolSet({
      workingDirectory: tempDir,
      filesystem: { enabled: true, rootDir: tempDir },
      shell: { enabled: true },
      web: { enabled: true },
      mcp: [{ name: "test-server", command: "echo", args: ["mcp"] }],
    });

    const tools = await toolSet.listTools();
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).toContain("filesystem_write_file");
    expect(toolNames).toContain("shell_run_command");
    expect(toolNames).toContain("web_search");
    expect(toolNames).toContain("mcp_test-server_call");

    const writeResult = await toolSet.execute("filesystem_write_file", {
      path: "routed.txt",
      content: "routed content",
    });
    expect(writeResult.ok).toBe(true);

    const readResult = await toolSet.execute("filesystem_read_file", {
      path: "routed.txt",
    });
    expect(readResult.ok).toBe(true);
    expect(readResult.output).toContain("routed content");

    const unknown = await toolSet.execute("nonexistent_tool", {});
    expect(unknown.ok).toBe(false);
    expect(unknown.output).toContain("Unknown tool");
  });

  it("returns empty tool list when no groups enabled", async () => {
    const toolSet = createToolSet({
      workingDirectory: tempDir,
    });
    const tools = await toolSet.listTools();
    expect(tools).toEqual([]);
  });
});
