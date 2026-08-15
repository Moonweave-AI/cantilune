import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, readErrorBody } from "../../src/httpClient.js";

describe("httpClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("returns successful responses without retrying", async () => {
    const response = new Response("ok", { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(response);

    const resultPromise = fetchWithRetry("https://example.com", { retries: 2 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(response);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and 5xx responses", async () => {
    const okResponse = new Response("ok", { status: 200 });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("server error", { status: 503 }))
      .mockResolvedValueOnce(okResponse);

    const resultPromise = fetchWithRetry("https://example.com", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
      retries: 2,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(okResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable client errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));

    const result = await fetchWithRetry("https://example.com", { retries: 2 });
    expect(result.status).toBe(400);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network errors and rethrows after exhausting retries", async () => {
    const networkError = new Error("network down");
    globalThis.fetch = vi.fn().mockRejectedValue(networkError);

    const resultPromise = fetchWithRetry("https://example.com", { retries: 1 });
    const expectation = expect(resultPromise).rejects.toThrow("network down");
    await vi.runAllTimersAsync();
    await expectation;
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("uses default timeout and retry settings", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    const resultPromise = fetchWithRetry("https://example.com");
    await vi.runAllTimersAsync();
    await resultPromise;

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.method).toBe("GET");
    expect(init.signal).toBeDefined();
  });

  it("reads error body text and falls back to statusText", async () => {
    const response = new Response("detailed error", { status: 500, statusText: "Server Error" });
    await expect(readErrorBody(response)).resolves.toBe("detailed error");

    const failingResponse = {
      text: vi.fn().mockRejectedValue(new Error("read failed")),
      statusText: "Gateway Timeout",
    } as unknown as Response;
    await expect(readErrorBody(failingResponse)).resolves.toBe("Gateway Timeout");
  });
});
