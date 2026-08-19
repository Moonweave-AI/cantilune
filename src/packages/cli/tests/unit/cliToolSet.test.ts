import { describe, expect, it } from "vitest";
import { createCliToolSet, parseMcpServerSpec } from "../../src/wiring/cliToolSet.js";

describe("parseMcpServerSpec", () => {
  it("parses HTTP MCP URLs", () => {
    const parsed = parseMcpServerSpec("https://mcp.example/sse");
    expect(parsed.rejected).toBeUndefined();
    expect(parsed.config).toEqual({
      name: "mcp.example",
      command: "https://mcp.example/sse",
    });
  });

  it("parses a named HTTP MCP URL", () => {
    const parsed = parseMcpServerSpec("docs=https://mcp.example/sse");
    expect(parsed.config).toEqual({
      name: "docs",
      command: "https://mcp.example/sse",
    });
  });

  it("falls back to http-mcp when the URL has no hostname", () => {
    const parsed = parseMcpServerSpec("https://");
    expect(parsed.config?.name).toBe("http-mcp");
    expect(parsed.config?.command).toBe("https://");
  });

  it("parses stdio name=command args", () => {
    const parsed = parseMcpServerSpec("docs=npx -y server");
    expect(parsed.rejected).toBeUndefined();
    expect(parsed.config).toEqual({
      name: "docs",
      command: "npx",
      args: ["-y", "server"],
    });
  });

  it("rejects an empty MCP command", () => {
    const parsed = parseMcpServerSpec("   ");
    expect(parsed.rejected).toBe("empty MCP command");
  });

  it("parses a bare command without a name=", () => {
    const parsed = parseMcpServerSpec("npx");
    expect(parsed.config).toEqual({ name: "npx", command: "npx" });
  });

  it("forwards sandbox: off for test hosts and keeps production default required", () => {
    const created = createCliToolSet({
      workingDirectory: process.cwd(),
      sandbox: "off",
    });
    expect(created.tools.applyMcpSurface).toBeTypeOf("function");
  });

  it("does not expose filesystem or shell tools without a selected directory", async () => {
    const created = createCliToolSet({
      sandbox: "off",
      filesystem: false,
      shell: false,
    });

    await expect(created.tools.listTools()).resolves.toEqual([
      expect.objectContaining({ name: "web_search" }),
      expect.objectContaining({ name: "web_fetch" }),
    ]);
  });
});
