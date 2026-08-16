import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as mcpBridge from "../../src/mcp/mcpBridge.js";
import {
  clearMcpDiscoveryCache,
  discoverMcpTools,
  getCachedToolSchemas,
  mcpToolToSchema,
} from "../../src/mcp/mcpDiscovery.js";
import { createMcpExecutor } from "../../src/mcp/mcpExecutor.js";
import type { McpConfig } from "../../src/types.js";

const baseConfig: McpConfig = {
  name: "test-server",
  command: "node",
  args: ["server.js"],
  env: { MCP_DEBUG: "1" },
};

function createMockClient(
  handlers: {
    listTools?: () => Promise<
      Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
    >;
    callTool?: (name: string, args: Record<string, unknown>) => Promise<mcpBridge.McpToolResult>;
    connectError?: Error;
  } = {},
): mcpBridge.McpClient {
  return {
    connect: vi.fn(async () => {
      if (handlers.connectError !== undefined) {
        throw handlers.connectError;
      }
    }),
    disconnect: vi.fn(),
    listTools: vi.fn(async () => {
      if (handlers.listTools !== undefined) {
        return handlers.listTools();
      }
      return [
        {
          name: "search",
          description: "Search documents",
          inputSchema: {
            type: "object",
            properties: { q: { type: "string", description: "Query" } },
            required: ["q"],
          },
        },
      ];
    }),
    callTool: vi.fn(async (name, args) => {
      if (handlers.callTool !== undefined) {
        return handlers.callTool(name, args);
      }
      return { content: [{ type: "text", text: `called ${name} with ${JSON.stringify(args)}` }] };
    }),
  };
}

describe("parseJsonRpcLine", () => {
  it("parses valid JSON-RPC response with result", () => {
    const line = '{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}';
    const parsed = mcpBridge.parseJsonRpcLine(line);
    expect(parsed).toEqual({ jsonrpc: "2.0", id: 1, result: { tools: [] } });
  });

  it("parses valid JSON-RPC error response", () => {
    const line = '{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"Method not found"}}';
    const parsed = mcpBridge.parseJsonRpcLine(line);
    expect(parsed?.error?.message).toBe("Method not found");
  });

  it("returns null for empty or invalid lines", () => {
    expect(mcpBridge.parseJsonRpcLine("")).toBeNull();
    expect(mcpBridge.parseJsonRpcLine("   ")).toBeNull();
    expect(mcpBridge.parseJsonRpcLine("not json")).toBeNull();
    expect(mcpBridge.parseJsonRpcLine('{"jsonrpc":"1.0","id":1}')).toBeNull();
    expect(mcpBridge.parseJsonRpcLine("null")).toBeNull();
    expect(mcpBridge.parseJsonRpcLine("42")).toBeNull();
  });

  it("parses notifications without id", () => {
    const parsed = mcpBridge.parseJsonRpcLine(
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
    );
    expect(parsed?.method).toBe("notifications/initialized");
    expect(parsed?.id).toBeUndefined();
  });
});

describe("formatMcpToolResult", () => {
  it("joins text content blocks", () => {
    const output = mcpBridge.formatMcpToolResult({
      content: [
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ],
    });
    expect(output).toBe("line one\nline two");
  });

  it("labels non-text content types and handles empty content", () => {
    expect(
      mcpBridge.formatMcpToolResult({
        content: [{ type: "image", text: "base64data" }],
        isError: true,
      }),
    ).toBe("[image] base64data");

    expect(mcpBridge.formatMcpToolResult({ content: [], isError: true })).toContain("error");
  });
});

describe("mcpToolToSchema", () => {
  it("converts MCP tool schema to ToolSchema with prefixed name", () => {
    const schema = mcpToolToSchema("my-server", {
      name: "fetch",
      description: "Fetch a URL",
      inputSchema: { type: "object", properties: { url: { type: "string" } } },
    });
    expect(schema.name).toBe("mcp_my-server_fetch");
    expect(schema.description).toBe("Fetch a URL");
  });

  it("uses fallback description when MCP tool has no description", () => {
    const schema = mcpToolToSchema("my-server", {
      name: "fetch",
      description: "",
      inputSchema: { type: "object", properties: {} },
    });
    expect(schema.description).toContain('MCP tool "fetch"');
  });
});

describe("discoverMcpTools", () => {
  beforeEach(() => {
    clearMcpDiscoveryCache();
  });

  afterEach(() => {
    clearMcpDiscoveryCache();
  });

  it("discovers and caches tools from MCP client", async () => {
    const client = createMockClient();
    const cache = await discoverMcpTools(client, "test-server");
    expect(cache.serverName).toBe("test-server");
    expect(cache.connected).toBe(true);
    expect(cache.tools[0]?.name).toBe("mcp_test-server_search");
  });

  it("returns cached result on subsequent calls", async () => {
    const client = createMockClient();
    const cacheA = await discoverMcpTools(client, "cached");
    const cacheB = await discoverMcpTools(client, "cached");
    expect(cacheA).toBe(cacheB);
    expect(client.listTools).toHaveBeenCalledTimes(1);
  });

  it("flattens cached schemas via getCachedToolSchemas", async () => {
    const clientA = createMockClient({
      listTools: async () => [
        { name: "a", description: "A", inputSchema: { type: "object", properties: {} } },
      ],
    });
    const clientB = createMockClient({
      listTools: async () => [
        { name: "b", description: "B", inputSchema: { type: "object", properties: {} } },
      ],
    });
    const cacheA = await discoverMcpTools(clientA, "a");
    const cacheB = await discoverMcpTools(clientB, "b");
    const schemas = getCachedToolSchemas([cacheA, cacheB]);
    expect(schemas.map((s) => s.name)).toEqual(["mcp_a_a", "mcp_b_b"]);
  });
});

describe("createMcpExecutor", () => {
  let createClientSpy: MockInstance<typeof mcpBridge.createMcpClient>;

  beforeEach(() => {
    clearMcpDiscoveryCache();
    createClientSpy = vi.spyOn(mcpBridge, "createMcpClient").mockReturnValue(createMockClient());
  });

  afterEach(() => {
    clearMcpDiscoveryCache();
    createClientSpy.mockRestore();
  });

  it("lists and executes discovered MCP tools", async () => {
    const executor = createMcpExecutor(baseConfig);
    const tools = await executor.listTools();
    expect(tools[0]?.name).toBe("mcp_test-server_search");

    const result = await executor.execute("mcp_test-server_search", { q: "hello" });
    expect(result.ok).toBe(true);
    expect(result.output).toContain("called search");
    expect(result.output).toContain("hello");
  });

  it("rejects unknown tool name", async () => {
    const executor = createMcpExecutor(baseConfig);
    await executor.listTools();
    const result = await executor.execute("mcp_other_call", { q: "x" });
    expect(result.ok).toBe(false);
    expect(result.output).toContain("Unknown MCP tool");
  });

  it("returns error when MCP tool reports isError", async () => {
    createClientSpy.mockReturnValue(
      createMockClient({
        callTool: async () => ({
          content: [{ type: "text", text: "tool failed" }],
          isError: true,
        }),
      }),
    );

    const executor = createMcpExecutor(baseConfig);
    await executor.listTools();
    const result = await executor.execute("mcp_test-server_search", { q: "fail" });
    expect(result.ok).toBe(false);
    expect(result.output).toBe("tool failed");
  });

  it("handles connection failures gracefully", async () => {
    createClientSpy.mockReturnValue(createMockClient({ connectError: new Error("spawn ENOENT") }));

    const executor = createMcpExecutor(baseConfig);
    const tools = await executor.listTools();
    expect(tools[0]?.name).toBe("mcp_test-server_unavailable");

    const unavailable = await executor.execute("mcp_test-server_unavailable", {});
    expect(unavailable.ok).toBe(false);
    expect(unavailable.output).toContain("not connected");

    const result = await executor.execute("mcp_test-server_search", { q: "x" });
    expect(result.ok).toBe(false);
  });

  it("skips MCP dispatch when already aborted", async () => {
    const executor = createMcpExecutor(baseConfig);
    const controller = new AbortController();
    controller.abort();
    const result = await executor.execute(
      "mcp_test-server_search",
      { q: "x" },
      { signal: controller.signal },
    );
    expect(result.ok).toBe(false);
    expect(result.output).toContain("aborted before MCP dispatch");
  });
});
