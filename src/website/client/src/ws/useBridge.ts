/**
 * WebSocket client for the Cantilune website bridge — ADR-0030.
 *
 * One connection per tab. Auto-reconnect with backoff. Exposes the latest
 * `ServerMessage` stream and a `send` helper. The browser is view + control;
 * all authority is server-side.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@shared/protocol";

const BRIDGE_URL =
  (typeof window !== "undefined" &&
    (window as { __CANTILUNE_BRIDGE_URL?: string }).__CANTILUNE_BRIDGE_URL) ||
  "ws://127.0.0.1:7474";

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

export interface BridgeApi {
  readonly status: ConnectionStatus;
  readonly send: (message: ClientMessage) => void;
  readonly lastMessage: ServerMessage | null;
}

export function useBridge(onMessage?: (message: ServerMessage) => void): BridgeApi {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let stopped = false;
    let attempt = 0;

    const connect = () => {
      if (stopped) return;
      const socket = new WebSocket(BRIDGE_URL);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        attempt = 0;
        setStatus("open");
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          setLastMessage(message);
          onMessageRef.current?.(message);
        } catch {
          // ignore malformed frames
        }
      });

      socket.addEventListener("close", () => {
        if (stopped) return;
        setStatus("closed");
        attempt += 1;
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        setTimeout(connect, delay);
      });

      socket.addEventListener("error", () => {
        setStatus("error");
      });
    };

    connect();
    return () => {
      stopped = true;
      socketRef.current?.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket !== null && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  return { status, send, lastMessage };
}
