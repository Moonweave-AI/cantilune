/**
 * Default HTTP send/receive for A2ATransportAdapter (ADR-0018 A28).
 * Uses fetch POST of raw frame bytes; fail-closed on non-2xx.
 */
import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../../foundation/commsViolation.js";

export function createHttpA2AFrameHandlers(options?: {
  readonly fetchImpl?: typeof fetch;
  readonly headers?: Record<string, string>;
}): {
  sendFrame: (endpoint: string, frame: Uint8Array) => Promise<Result<void, CommsViolation>>;
  receiveFrame: (endpoint: string) => Promise<Result<Uint8Array, CommsViolation>>;
} {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const headers = {
    "Content-Type": "application/octet-stream",
    Accept: "application/octet-stream",
    ...options?.headers,
  };

  return {
    async sendFrame(endpoint, frame) {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers,
          body: Buffer.from(frame),
        });
        if (!response.ok) {
          return err(
            commsViolation(
              "transport_failed",
              "send",
              `A2A HTTP send failed (${response.status})`,
              { retryable: response.status >= 500 },
            ),
          );
        }
        return ok(undefined);
      } catch (error) {
        return err(
          commsViolation(
            "transport_failed",
            "send",
            error instanceof Error ? error.message : String(error),
            { retryable: true },
          ),
        );
      }
    },

    async receiveFrame(endpoint) {
      try {
        const response = await fetchImpl(endpoint, {
          method: "GET",
          headers: { Accept: "application/octet-stream", ...options?.headers },
        });
        if (response.status === 204 || response.status === 404) {
          return err(
            commsViolation("transport_failed", "receive", "A2A HTTP inbox empty", {
              retryable: true,
            }),
          );
        }
        if (!response.ok) {
          return err(
            commsViolation(
              "transport_failed",
              "receive",
              `A2A HTTP receive failed (${response.status})`,
              { retryable: response.status >= 500 },
            ),
          );
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0) {
          return err(
            commsViolation("transport_failed", "receive", "A2A HTTP empty body", {
              retryable: true,
            }),
          );
        }
        return ok(bytes);
      } catch (error) {
        return err(
          commsViolation(
            "transport_failed",
            "receive",
            error instanceof Error ? error.message : String(error),
            { retryable: true },
          ),
        );
      }
    },
  };
}
