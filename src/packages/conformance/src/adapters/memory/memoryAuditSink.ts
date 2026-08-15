import type { AuditSink } from "../../ports/auditSink.js";

/** No-op audit sink for tests and CLI tooling — not for production verification pipelines. */
export function createNoopAuditSink(): AuditSink {
  return { emit() {} };
}
