/**
 * JudgeAuditJournal (ADR-0020 §6) — an append-only, in-memory audit journal for
 * LLM judge call records. The journal is sanitized: it stores only digests and
 * model ids, never raw prompts or secrets. A tampered journal invalidates any
 * termination claim that relied on a judge (RFC-0004 §12 audit-tail rule).
 *
 * P0/J0 ships an in-memory journal; persistence to a durable sink is J4 (post
 * review) and is intentionally out of scope here. The drain semantics let the
 * termination controller collect a turn's records into the verdict audit.
 */
import type { JudgeCallRecord } from "./types.js";

export interface JudgeAuditJournal {
  /** Append one sanitized record. Append-only: records are never mutated. */
  record(rec: JudgeCallRecord): void;
  /**
   * Drain all records since the last drain — used by the controller at end of
   * a turn to attach the turn's judge records to the verdict audit. Draining
   * clears the buffer so the next turn starts fresh.
   */
  drain(): readonly JudgeCallRecord[];
  /** Peek without draining (testing/diagnostics). */
  peek(): readonly JudgeCallRecord[];
}

export function createJudgeAuditJournal(): JudgeAuditJournal {
  const records: JudgeCallRecord[] = [];
  return {
    record(rec) {
      records.push(rec);
    },
    drain() {
      const snapshot = [...records];
      records.length = 0;
      return snapshot;
    },
    peek() {
      return [...records];
    },
  };
}
