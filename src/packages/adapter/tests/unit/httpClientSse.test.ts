import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, readSseStream } from "../../src/httpClient.js";

/** Serves `chunks` as a single `text/event-stream` response body. */
function sseResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

async function collect(response: Response): Promise<string[]> {
  const payloads: string[] = [];
  for await (const payload of readSseStream(response)) payloads.push(payload);
  return payloads;
}

describe("readSseStream", () => {
  it("yields data payloads in arrival order", async () => {
    const response = sseResponse(['data: {"i":1}\n', 'data: {"i":2}\n']);
    await expect(collect(response)).resolves.toEqual(['{"i":1}', '{"i":2}']);
  });

  it("stops at the [DONE] sentinel and ignores anything after it", async () => {
    const response = sseResponse(['data: {"i":1}\n', "data: [DONE]\n", 'data: {"i":2}\n']);
    await expect(collect(response)).resolves.toEqual(['{"i":1}']);
  });

  it("skips comments, non-data fields, and empty data lines", async () => {
    const response = sseResponse([
      ": keep-alive comment\n",
      "event: message\n",
      "id: 42\n",
      "data:\n",
      "\n",
      'data: {"kept":true}\n',
    ]);
    await expect(collect(response)).resolves.toEqual(['{"kept":true}']);
  });

  it("buffers a payload split across chunk boundaries", async () => {
    const response = sseResponse(['data: {"sp', 'lit":true}\n']);
    await expect(collect(response)).resolves.toEqual(['{"split":true}']);
  });

  it("tolerates CRLF line endings", async () => {
    const response = sseResponse(['data: {"crlf":true}\r\n', "data: [DONE]\r\n"]);
    await expect(collect(response)).resolves.toEqual(['{"crlf":true}']);
  });

  it("emits a final event when the body ends without a trailing newline", async () => {
    const response = sseResponse(['data: {"first":1}\n', 'data: {"tail":2}']);
    await expect(collect(response)).resolves.toEqual(['{"first":1}', '{"tail":2}']);
  });

  it("suppresses a trailing [DONE] that arrives without a newline", async () => {
    const response = sseResponse(['data: {"first":1}\n', "data: [DONE]"]);
    await expect(collect(response)).resolves.toEqual(['{"first":1}']);
  });

  it("ignores a trailing fragment that carries no payload", async () => {
    const response = sseResponse(['data: {"first":1}\n', "event: done"]);
    await expect(collect(response)).resolves.toEqual(['{"first":1}']);
  });

  it("yields nothing for a body-less response", async () => {
    await expect(collect(new Response(null, { status: 204 }))).resolves.toEqual([]);
  });

  it("releases the reader lock when the consumer stops early", async () => {
    const response = sseResponse(['data: {"i":1}\n', 'data: {"i":2}\n']);
    for await (const payload of readSseStream(response)) {
      expect(payload).toBe('{"i":1}');
      break;
    }
    // A lock still held here would make a second reader throw.
    expect(() => response.body?.getReader()).not.toThrow();
  });

  /**
   * Unlocking alone left the server streaming into a body nobody read. The
   * connection has to be cancelled on every early exit.
   */
  it("cancels the body when the consumer stops early", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"i":1}\n'));
      },
      cancel() {
        cancelled = true;
      },
    });

    for await (const payload of readSseStream(new Response(body))) {
      expect(payload).toBe('{"i":1}');
      break;
    }

    expect(cancelled).toBe(true);
  });

  it("cancels the body when the stream stops at the [DONE] sentinel", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"i":1}\ndata: [DONE]\n'));
      },
      cancel() {
        cancelled = true;
      },
    });

    await collect(new Response(body));

    expect(cancelled).toBe(true);
  });
});

describe("fetchWithRetry cancellation", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("aborts immediately when the caller signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return init.signal?.aborted === true
        ? Promise.reject(new Error("aborted"))
        : Promise.resolve(new Response("ok"));
    });

    await expect(
      fetchWithRetry("https://example.com", { signal: controller.signal, retries: 3 }),
    ).rejects.toThrow("aborted");
    // A deliberate cancellation must not be retried.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("stops retrying once the caller aborts mid-flight", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new Error("network down"));
    });

    await expect(
      fetchWithRetry("https://example.com", { signal: controller.signal, retries: 5 }),
    ).rejects.toThrow("network down");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  /**
   * `fetch` settles at the response headers, so cancellation used to be
   * unhooked before a streaming body was read at all: aborting a run left the
   * generation running, and still billable, to completion.
   */
  it("still cancels the request after the response headers have arrived", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      requestSignal = init.signal ?? undefined;
      return Promise.resolve(new Response("streaming body"));
    });

    await fetchWithRetry("https://example.com", { signal: controller.signal });
    expect(requestSignal?.aborted).toBe(false);

    controller.abort();

    expect(requestSignal?.aborted).toBe(true);
  });

  it("cancels the request when the caller aborts while the body is streaming", async () => {
    const controller = new AbortController();
    let cancelReason: unknown;
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode('data: {"i":1}\n'));
          init.signal?.addEventListener("abort", () => {
            cancelReason = "aborted";
            streamController.error(new Error("aborted"));
          });
        },
      });
      return Promise.resolve(new Response(body));
    });

    const response = await fetchWithRetry("https://example.com", { signal: controller.signal });
    const stream = readSseStream(response);
    await stream.next();
    controller.abort();
    await stream.return(undefined);

    expect(cancelReason).toBe("aborted");
  });
});
