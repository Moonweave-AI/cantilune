import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AuditSink, ConformanceAuditEvent } from "../../ports/auditSink.js";

const AUDIT_FILE = "audit.jsonl";

export interface FileAuditSinkOptions {
  readonly dir: string;
}

export function createFileAuditSink(options: FileAuditSinkOptions): AuditSink {
  const { dir } = options;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, AUDIT_FILE);

  return {
    emit(event: ConformanceAuditEvent) {
      appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
    },
  };
}
