import { describe, expect, it } from "vitest";
import { createHttpA2AFrameHandlers } from "../../src/transports/a2a/a2aHttpFrames.js";

function jsonResponse(status: number, body?: Uint8Array): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => (body ?? new Uint8Array()).buffer,
  } as Response;
}

describe("createHttpA2AFrameHandlers", () => {
  it("POSTs frame bytes and treats 2xx as success", async () => {
    const seen: { method: string | undefined; body: Buffer | undefined } = {
      method: undefined,
      body: undefined,
    };
    const handlers = createHttpA2AFrameHandlers({
      fetchImpl: (async (_url, init) => {
        seen.method = typeof init?.method === "string" ? init.method : undefined;
        seen.body = Buffer.from(init?.body as Buffer);
        return jsonResponse(204);
      }) as typeof fetch,
    });
    const sent = await handlers.sendFrame("https://example.invalid/a2a", Uint8Array.of(1, 2, 3));
    expect(sent.ok).toBe(true);
    expect(seen.method).toBe("POST");
    expect(seen.body?.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it("fail-closes send on 4xx and marks 5xx retryable", async () => {
    const client = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(400)) as typeof fetch,
    });
    const denied = await client.sendFrame("https://example.invalid/a2a", Uint8Array.of(1));
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.retryable).toBe(false);
    }
    const server = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(503)) as typeof fetch,
    });
    const retry = await server.sendFrame("https://example.invalid/a2a", Uint8Array.of(1));
    expect(retry.ok).toBe(false);
    if (!retry.ok) {
      expect(retry.error.retryable).toBe(true);
    }
  });

  it("maps network errors, empty inbox, and empty body to transport_failed", async () => {
    const down = createHttpA2AFrameHandlers({
      fetchImpl: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
    });
    const sendErr = await down.sendFrame("https://example.invalid/a2a", Uint8Array.of(1));
    expect(sendErr.ok).toBe(false);
    const recvErr = await down.receiveFrame("https://example.invalid/a2a");
    expect(recvErr.ok).toBe(false);

    const empty = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(204)) as typeof fetch,
    });
    const inbox = await empty.receiveFrame("https://example.invalid/a2a");
    expect(inbox.ok).toBe(false);
    const missing = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(404)) as typeof fetch,
    });
    const absent = await missing.receiveFrame("https://example.invalid/a2a");
    expect(absent.ok).toBe(false);

    const blank = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(200, new Uint8Array())) as typeof fetch,
    });
    const body = await blank.receiveFrame("https://example.invalid/a2a");
    expect(body.ok).toBe(false);
  });

  it("returns received bytes on 200", async () => {
    const handlers = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(200, Uint8Array.of(9, 8))) as typeof fetch,
    });
    const received = await handlers.receiveFrame("https://example.invalid/a2a");
    expect(received.ok).toBe(true);
    if (received.ok) {
      expect(Buffer.from(received.value)).toEqual(Buffer.from([9, 8]));
    }
  });

  it("marks receive 5xx retryable and 4xx not", async () => {
    const server = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(500)) as typeof fetch,
    });
    const retry = await server.receiveFrame("https://example.invalid/a2a");
    expect(retry.ok).toBe(false);
    if (!retry.ok) {
      expect(retry.error.retryable).toBe(true);
    }
    const client = createHttpA2AFrameHandlers({
      fetchImpl: (async () => jsonResponse(401)) as typeof fetch,
    });
    const denied = await client.receiveFrame("https://example.invalid/a2a");
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.retryable).toBe(false);
    }
  });
});
