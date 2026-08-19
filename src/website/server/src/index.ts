/**
 * Website bridge server entry — ADR-0030.
 *
 * Binds to localhost only. One WebSocket connection per browser tab → one
 * `BridgeSession` (one booted OS). Rejects non-loopback origins so a remote
 * page cannot drive the local harness.
 *
 * Unverified until run.
 */

import { createServer } from "node:http";
import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer } from "ws";
import { BridgeSession } from "./bridge.js";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.js";

const PORT = Number(process.env.CANTILUNE_WEBSITE_PORT ?? 7474);
const HOST = process.env.CANTILUNE_WEBSITE_HOST ?? "127.0.0.1";

const LOOPBACK_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  // Vite dev server origins (the client in dev mode):
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return false;
  return LOOPBACK_ORIGINS.has(origin);
}

const sessions = new Set<BridgeSession>();

function start(): Server {
  const httpServer = createServer((_req: IncomingMessage, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "cantilune-website-bridge", status: "ok" }));
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (socket, request) => {
    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin)) {
      socket.close(1008, "origin not allowed");
      return;
    }

    const send = (message: ServerMessage) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const session = new BridgeSession({ socket, send });
    sessions.add(session);

    socket.on("message", (data) => {
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        send({ type: "error", scope: "transport", message: "invalid JSON" });
        return;
      }
      void session.handle(parsed);
    });

    socket.on("close", () => {
      sessions.delete(session);
      void session.shutdown();
    });

    socket.on("error", () => {
      sessions.delete(session);
      void session.shutdown();
    });
  });

  httpServer.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[cantilune-website-bridge] listening on http://${HOST}:${PORT} (localhost only)`);
  });

  return httpServer;
}

const server = start();

function shutdown(): void {
  for (const session of sessions) {
    void session.shutdown();
  }
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
