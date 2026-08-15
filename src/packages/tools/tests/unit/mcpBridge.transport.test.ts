import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { createMcpClient, formatMcpToolResult } from "../../src/mcp/mcpBridge.js";
import type { McpConfig } from "../../src/types.js";

const baseConfig: McpConfig = {
  name: "transport-server",
  command: "node",
  args: ["server.js"],
};

function createFakeProcess() {
  const stdout = new PassThrough();
  const stdin = new PassThrough();
  const proc = Object.assign(new EventEmitter(), {
    stdin,
    stdout,
    kill: vi.fn(),
  });
  spawnMock.mockReturnValue(proc);
  return { proc, stdin, stdout };
}

function autoRespond(stdin: PassThrough, stdout: PassThrough): void {
  stdin.on("data", (chunk: Buffer) => {
    const message = JSON.parse(chunk.toString().trim()) as { method: string; id?: number };
    if (message.method === "initialize") {
      stdout.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { capabilities: {} } })}\n`,
      );
      return;
    }
    if (message.method === "tools/list") {
      stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            tools: [
              {
                name: "ping",
                description: "Ping tool",
                inputSchema: { type: "object", properties: {} },
              },
            ],
          },
        })}\n`,
      );
      return;
    }
    if (message.method === "tools/call") {
      stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: { content: [{ type: "text", text: "pong" }] },
        })}\n`,
      );
    }
  });
}

describe("createMcpClient stdio transport", () => {
  afterEach(() => {
    spawnMock.mockReset();
  });

  it("connects with initialize handshake and lists tools", async () => {
    const { stdin, stdout } = createFakeProcess();
    autoRespond(stdin, stdout);

    const client = createMcpClient(baseConfig);
    await client.connect();

    const tools = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("ping");
    expect(spawnMock).toHaveBeenCalledWith(
      "node",
      ["server.js"],
      expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] }),
    );

    client.disconnect();
  });

  it("calls remote tools via tools/call", async () => {
    const { stdin, stdout } = createFakeProcess();
    autoRespond(stdin, stdout);

    const client = createMcpClient(baseConfig);
    await client.connect();

    const result = await client.callTool("ping", { message: "hi" });
    expect(result.content[0]?.text).toBe("pong");

    client.disconnect();
  });

  it("rejects requests when server returns JSON-RPC error", async () => {
    const { stdin, stdout } = createFakeProcess();
    stdin.on("data", (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString().trim()) as { method: string; id?: number };
      if (message.method === "initialize") {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`);
        return;
      }
      stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: "Method not found" },
        })}\n`,
      );
    });

    const client = createMcpClient(baseConfig);
    await client.connect();
    await expect(client.listTools()).rejects.toThrow("Method not found");
    client.disconnect();
  });

  it("ignores invalid JSON lines on stdout", async () => {
    const { stdin, stdout } = createFakeProcess();
    autoRespond(stdin, stdout);

    const client = createMcpClient(baseConfig);
    await client.connect();
    stdout.write("not-json\n");
    stdout.write('{"jsonrpc":"2.0","method":"log","params":{"msg":"hello"}}\n');

    const tools = await client.listTools();
    expect(tools[0]?.name).toBe("ping");
    client.disconnect();
  });

  it("rejects pending requests when process exits", async () => {
    const { proc, stdin, stdout } = createFakeProcess();
    stdin.on("data", (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString().trim()) as { method: string; id?: number };
      if (message.method === "initialize") {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`);
      }
    });

    const client = createMcpClient(baseConfig);
    await client.connect();

    const pending = client.listTools();
    proc.emit("exit", 1, null);
    await expect(pending).rejects.toThrow("exited unexpectedly");
  });

  it("times out when server does not respond", async () => {
    const { stdin, stdout } = createFakeProcess();
    stdin.on("data", (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString().trim()) as { method: string; id?: number };
      if (message.method === "initialize") {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`);
      }
    });

    const client = createMcpClient(baseConfig, { timeoutMs: 50 });
    await client.connect();
    await expect(client.listTools()).rejects.toThrow("timed out");
    client.disconnect();
  });

  it("formatMcpToolResult handles missing description defaults in listTools", async () => {
    const { stdin, stdout } = createFakeProcess();
    stdin.on("data", (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString().trim()) as { method: string; id?: number };
      if (message.method === "initialize") {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`);
        return;
      }
      if (message.method === "tools/list") {
        stdout.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            result: { tools: [{ name: "bare" }] },
          })}\n`,
        );
      }
    });

    const client = createMcpClient(baseConfig);
    await client.connect();
    const tools = await client.listTools();
    expect(tools[0]).toEqual({
      name: "bare",
      description: "",
      inputSchema: { type: "object", properties: {} },
    });
    client.disconnect();
  });

  it("formatMcpToolResult returns empty string for success with no content", () => {
    expect(formatMcpToolResult({ content: [] })).toBe("");
  });

  it("skips reconnect when already connected", async () => {
    const { stdin, stdout } = createFakeProcess();
    autoRespond(stdin, stdout);

    const client = createMcpClient(baseConfig);
    await client.connect();
    await client.connect();
    expect(spawnMock).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("rejects pending requests on process error event", async () => {
    const { proc, stdin, stdout } = createFakeProcess();
    stdin.on("data", (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString().trim()) as { method: string; id?: number };
      if (message.method === "initialize") {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`);
      }
    });

    const client = createMcpClient(baseConfig);
    await client.connect();

    const pending = client.listTools();
    proc.emit("error", new Error("spawn failed"));
    await expect(pending).rejects.toThrow("spawn failed");
  });

  it("propagates isError from tools/call", async () => {
    const { stdin, stdout } = createFakeProcess();
    stdin.on("data", (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString().trim()) as { method: string; id?: number };
      if (message.method === "initialize") {
        stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`);
        return;
      }
      if (message.method === "tools/call") {
        stdout.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            result: { content: [{ type: "text", text: "bad" }], isError: true },
          })}\n`,
        );
      }
    });

    const client = createMcpClient(baseConfig);
    await client.connect();
    const result = await client.callTool("ping", {});
    expect(result.isError).toBe(true);
    client.disconnect();
  });

  it("rejects RPC calls before connect", async () => {
    const client = createMcpClient(baseConfig);
    await expect(client.listTools()).rejects.toThrow("not connected");
  });

  it("rejects when stdin write fails", async () => {
    const { stdin, stdout } = createFakeProcess();
    autoRespond(stdin, stdout);

    const client = createMcpClient(baseConfig);
    await client.connect();

    const originalWrite = stdin.write.bind(stdin);
    stdin.write = ((_data: unknown, encoding?: unknown, callback?: unknown) => {
      // The callback lands in the 2nd or 3rd slot depending on the overload used.
      const done = [callback, encoding].find(
        (arg): arg is (err: Error) => void => typeof arg === "function",
      );
      done?.(new Error("write failed"));
      return false;
    }) as typeof stdin.write;

    await expect(client.listTools()).rejects.toThrow("write failed");
    stdin.write = originalWrite;
    client.disconnect();
  });
});
