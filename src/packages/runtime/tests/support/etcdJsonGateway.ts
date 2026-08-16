import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type { RaftKv } from "../../src/memory/raftKv.js";
import { createMemoryEtcdJsonClient } from "./memoryEtcdJsonClient.js";

export interface EtcdJsonGateway {
  readonly url: string;
  close(): void;
}

export interface EtcdHttpStubHandler {
  (
    path: string,
    body: Record<string, unknown>,
  ): { status: number; payload: Record<string, unknown> };
}

/**
 * Official etcd v3 JSON gateway in a child process.
 * Required when the caller uses EtcdRaftKv's worker + Atomics.wait — an
 * in-process HTTP server would be frozen on the same event loop.
 */
export async function startProcessEtcdGateway(
  env: NodeJS.ProcessEnv = {},
): Promise<EtcdJsonGateway> {
  const script = fileURLToPath(new URL("./etcdJsonGatewayProcess.mjs", import.meta.url));
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const port = await waitForListening(child);
  return {
    url: `http://127.0.0.1:${String(port)}`,
    close() {
      child.kill();
    },
  };
}

/** In-process stub for main-thread fetch (probe / injected client). */
export async function startMemoryEtcdGateway(kv: RaftKv): Promise<EtcdJsonGateway> {
  const client = createMemoryEtcdJsonClient(kv);
  return startEtcdHttpStub((path, body) => ({ status: 200, payload: client.post(path, body) }));
}

export async function startEtcdHttpStub(handler: EtcdHttpStubHandler): Promise<EtcdJsonGateway> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on("end", () => {
        reply(handler, request, Buffer.concat(chunks), response);
      });
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        closeServer(server);
        reject(new Error("etcd JSON gateway failed to bind"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${String(address.port)}`,
        close() {
          closeServer(server);
        },
      });
    });
  });
}

function waitForListening(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("etcd gateway process did not listen"));
    }, 5_000);
    const onExit = (code: number | null) => {
      clearTimeout(timer);
      reject(new Error(`etcd gateway process exited ${String(code)}`));
    };
    child.once("exit", onExit);
    child.once("error", (error) => {
      clearTimeout(timer);
      child.off("exit", onExit);
      reject(error);
    });
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const match = /LISTENING (\d+)/u.exec(buffer);
      if (match?.[1] === undefined) {
        return;
      }
      clearTimeout(timer);
      child.off("exit", onExit);
      resolve(Number(match[1]));
    });
  });
}

function reply(
  handler: EtcdHttpStubHandler,
  request: IncomingMessage,
  raw: Buffer,
  response: ServerResponse,
): void {
  try {
    const body =
      raw.length === 0 ? {} : (JSON.parse(raw.toString("utf8")) as Record<string, unknown>);
    const result = handler(request.url ?? "/", body);
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.payload));
  } catch (error) {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}

function closeServer(server: Server): void {
  server.close();
}
