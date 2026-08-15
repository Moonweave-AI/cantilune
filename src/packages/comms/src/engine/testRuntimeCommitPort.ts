import type { RuntimeCommitPort } from "../ports/runtimePorts.js";

/**
 * In-memory runtime commit port for tests and composition roots in `mode: "test"` only.
 * Do not use in production — wire a real RuntimeCommitPort from @cantilune/runtime.
 */
export function testRuntimeCommitPort(): RuntimeCommitPort {
  return {
    commitReconnect: async () => ({
      ok: true as const,
      value: { receiptRef: "runtime-receipt-test" },
    }),
    commitMessage: async () => ({
      ok: true as const,
      value: { receiptRef: "runtime-message-test" },
    }),
  };
}
