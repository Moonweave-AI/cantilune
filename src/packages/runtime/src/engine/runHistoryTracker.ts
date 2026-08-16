import type { CoordinationChange, ObservationEntry, UnvalidatedTrace } from "@cantilune/core";
import { appendObservationSegment, appendRewriteSegment, emptyRunHistory } from "@cantilune/core";

/** Tracks UnvalidatedTrace alongside runtime observe/commit for I6 alignment. */
export class RunHistoryTracker {
  private history: UnvalidatedTrace = emptyRunHistory();

  current(): UnvalidatedTrace {
    return this.history;
  }

  recordObservation(entry: ObservationEntry): void {
    this.history = appendObservationSegment(this.history, entry);
  }

  /** Rebuild observation segments after a durable resume (ADR-0021). */
  seedFromAuditTail(entries: readonly ObservationEntry[]): void {
    for (const entry of entries) {
      this.recordObservation(entry);
    }
  }

  recordChange(change: CoordinationChange): void {
    this.history = appendRewriteSegment(this.history, change);
  }

  reset(): void {
    this.history = emptyRunHistory();
  }
}
