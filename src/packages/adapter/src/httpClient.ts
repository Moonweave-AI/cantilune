import type { AdapterOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

export interface FetchWithRetryOptions extends AdapterOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
  /**
   * Caller cancellation, composed with the attempt timeout. Both cover the whole
   * request including a streaming body, not just the wait for headers.
   */
  readonly signal?: AbortSignal;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildRequestInit(options: FetchWithRetryOptions, signal: AbortSignal): RequestInit {
  const init: RequestInit = {
    method: options.method ?? "GET",
    signal,
  };
  if (options.headers !== undefined) {
    init.headers = options.headers;
  }
  if (options.body !== undefined) {
    init.body = options.body;
  }
  return init;
}

/**
 * One attempt, cancelled by either the caller or the attempt timeout.
 *
 * The two signals are composed rather than bridged by hand because `fetch`
 * settles as soon as the response headers arrive: a hand-rolled bridge that
 * detached in a `finally` here stopped covering the request at exactly the
 * point a streaming body starts being read, so cancelling a run could no
 * longer stop a generation it was still being billed for. A composed signal
 * stays attached to the request for as long as its body is alive, and is
 * released with the request rather than at headers.
 */
async function attemptFetch(
  url: string,
  options: FetchWithRetryOptions,
  timeout: number,
): Promise<Response> {
  const signal =
    options.signal === undefined
      ? AbortSignal.timeout(timeout)
      : AbortSignal.any([options.signal, AbortSignal.timeout(timeout)]);

  return await fetch(url, buildRequestInit(options, signal));
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await attemptFetch(url, options, timeout);
      if (response.ok || !isRetryableStatus(response.status) || attempt >= retries) {
        return response;
      }
    } catch (error) {
      lastError = error;
      // A caller-initiated abort is deliberate; retrying would defeat cancellation.
      if (options.signal?.aborted === true || attempt >= retries) {
        throw error;
      }
    }
    await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("fetchWithRetry failed");
}

export async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}

/**
 * Parse a `text/event-stream` body into individual SSE `data:` payloads.
 *
 * Yields raw payload strings in arrival order and stops at the `[DONE]`
 * sentinel used by OpenAI-compatible endpoints. Comment lines (`:`) and
 * non-data fields are skipped; partial lines are buffered across chunks.
 */
/** The payload carried by one SSE line, or undefined when it carries none. */
function ssePayload(line: string): string | undefined {
  if (!line.startsWith("data:")) return undefined;
  const payload = line.slice(5).trim();
  return payload.length > 0 ? payload : undefined;
}

export async function* readSseStream(response: Response): AsyncGenerator<string> {
  const body = response.body;
  if (body === null) {
    return;
  }

  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let drained = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");

        const payload = ssePayload(line);
        if (payload === "[DONE]") return;
        if (payload !== undefined) yield payload;
      }
    }

    // A body that ends without a trailing newline still holds one final event.
    const tail = ssePayload(buffer.trim());
    if (tail !== undefined && tail !== "[DONE]") {
      yield tail;
    }
    drained = true;
  } finally {
    // Cancelled rather than merely unlocked: every exit other than a fully read
    // body — the `[DONE]` sentinel, an abort, a consumer that stops iterating —
    // otherwise left the connection open with the server still sending.
    if (!drained) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}
