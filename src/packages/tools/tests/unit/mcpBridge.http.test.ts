import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  createMcpClient,
  isHttpMcpEndpoint,
  parseSseJsonRpc,
} from "../../src/mcp/mcpBridge.js";

function rpcResult(id: number, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function createScriptedFetch(script: {
  readonly onPost: (body: Record<string, unknown>, headers: Headers) => Response;
  readonly deletes?: string[];
}): typeof fetch {
  return (async (input, init) => {
    const method = init?.method ?? "GET";
    if (method === "DELETE") {
      script.deletes?.push(String(input));
      return new Response(null, { status: 204 });
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return script.onPost(body, new Headers(init?.headers));
  }) as typeof fetch;
}

describe("HTTP MCP transport", () => {
  it("recognizes HTTP endpoints", () => {
    expect(isHttpMcpEndpoint("https://mcp.example/sse")).toBe(true);
    expect(isHttpMcpEndpoint("http://127.0.0.1:3000/mcp")).toBe(true);
    expect(isHttpMcpEndpoint("npx")).toBe(false);
  });

  it("parses SSE JSON-RPC and falls back to a raw body", () => {
    expect(
      parseSseJsonRpc('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n'),
    ).toEqual({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    expect(parseSseJsonRpc('{"jsonrpc":"2.0","id":2,"result":{}}')).toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: {},
    });
    expect(parseSseJsonRpc("data: not-json\n")).toBeNull();
    expect(
      parseSseJsonRpc('data: {"jsonrpc":"2.0"\ndata: ,"id":3,"result":{"joined":true}}\n'),
    ).toEqual({ jsonrpc: "2.0", id: 3, result: { joined: true } });
  });

  it("uses platform fetch against a local Streamable HTTP server", async () => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        if (req.method === "DELETE") {
          res.writeHead(204);
          res.end();
          return;
        }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
          id?: number;
          method?: string;
        };
        const id = typeof body.id === "number" ? body.id : 1;
        res.writeHead(200, {
          "content-type": "application/json",
          "mcp-session-id": "local",
        });
        if (body.method === "tools/list") {
          res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: [] } }));
          return;
        }
        res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { capabilities: {} } }));
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const client = createMcpClient({
      name: "local",
      command: `http://127.0.0.1:${port}/mcp`,
    });
    await client.connect();
    expect(await client.listTools()).toEqual([]);
    client.disconnect();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error !== null && error !== undefined) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("connects, lists tools, and calls over JSON HTTP", async () => {
    const deletes: string[] = [];
    const fetchImpl = createScriptedFetch({
      deletes,
      onPost: (body) => {
        const id = typeof body.id === "number" ? body.id : 1;
        if (body.method === "initialize") {
          return new Response(rpcResult(id, { capabilities: {} }), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "mcp-session-id": "sess-1",
            },
          });
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        if (body.method === "tools/list") {
          return new Response(
            rpcResult(id, {
              tools: [{ name: "ping", description: "Ping", inputSchema: { type: "object" } }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          rpcResult(id, { content: [{ type: "text", text: "pong" }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const client = createMcpClient(
      { name: "remote", command: "https://mcp.example/sse" },
      { fetchImpl },
    );
    await client.connect();
    await client.connect();
    const tools = await client.listTools();
    expect(tools[0]?.name).toBe("ping");
    const result = await client.callTool("ping", {});
    expect(result.content[0]?.text).toBe("pong");
    client.disconnect();
    expect(deletes).toEqual(["https://mcp.example/sse"]);
  });

  it("accepts SSE responses and rejects HTTP errors", async () => {
    const fetchImpl = createScriptedFetch({
      onPost: (body) => {
        const id = typeof body.id === "number" ? body.id : 1;
        if (body.method === "initialize") {
          return new Response(
            `event: message\ndata: ${rpcResult(id, { capabilities: {} })}\n\n`,
            { status: 200, headers: { "content-type": "text/event-stream" } },
          );
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        return new Response("nope", { status: 503 });
      },
    });
    const client = createMcpClient(
      { name: "remote", command: "http://127.0.0.1:9/mcp" },
      { fetchImpl },
    );
    await client.connect();
    await expect(client.listTools()).rejects.toThrow(/MCP HTTP 503/);
    client.disconnect();
  });

  it("rejects a non-JSON-RPC HTTP body and a JSON-RPC error", async () => {
    let calls = 0;
    const fetchImpl = createScriptedFetch({
      onPost: (body) => {
        calls += 1;
        const id = typeof body.id === "number" ? body.id : 1;
        if (calls === 1) {
          return new Response("not-rpc", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "missing" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    const client = createMcpClient(
      { name: "remote", command: "https://mcp.example/sse" },
      { fetchImpl },
    );
    await expect(client.connect()).rejects.toThrow(/not JSON-RPC/);
    await expect(client.connect()).rejects.toThrow(/missing/);
  });

  it("times out an aborted HTTP request and refuses work before connect", async () => {
    const fetchImpl = (async (_input, init) => {
      await new Promise<void>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const client = createMcpClient(
      { name: "remote", command: "https://mcp.example/sse" },
      { fetchImpl, timeoutMs: 20 },
    );
    await expect(client.connect()).rejects.toThrow(/timed out/);
    const idle = createMcpClient(
      { name: "remote", command: "https://mcp.example/sse" },
      { fetchImpl: createScriptedFetch({ onPost: () => new Response(null, { status: 200 }) }) },
    );
    await expect(idle.listTools()).rejects.toThrow(/not connected/);
    idle.disconnect();
  });

  it("ignores a failed HTTP session DELETE", async () => {
    const fetchImpl = (async (_input, init) => {
      if (init?.method === "DELETE") {
        throw new Error("offline");
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { id?: number; method?: string };
      const id = typeof body.id === "number" ? body.id : 1;
      if (body.method === "initialize") {
        return new Response(rpcResult(id, { capabilities: {} }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "mcp-session-id": "sess-2",
          },
        });
      }
      return new Response(null, { status: 202 });
    }) as typeof fetch;
    const client = createMcpClient(
      { name: "remote", command: "https://mcp.example/sse" },
      { fetchImpl },
    );
    await client.connect();
    expect(() => {
      client.disconnect();
    }).not.toThrow();
  });
});
