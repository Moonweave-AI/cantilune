import type { CollaborationSnapshot } from "./collaborationSnapshot.js";
import type { CoordinationChange } from "./coordinationChange.js";
import type { ObservationEntry } from "../nodes/observationEntry.js";
import { observationSegments } from "../structure/trace.js";
import type { RunHistory } from "../structure/trace.js";

/** Validates committed changes form a continuous beforeRef → afterRef chain. */
export function validateBeforeRefChain(changes: readonly CoordinationChange[]): void {
  for (let i = 1; i < changes.length; i++) {
    const prev = changes[i - 1];
    const curr = changes[i];
    if (prev === undefined || curr === undefined) {
      continue;
    }
    if (curr.beforeRef !== prev.afterRef) {
      throw new Error(
        `beforeRef chain broken at ${curr.changeId}: expected ${prev.afterRef}, got ${curr.beforeRef}`,
      );
    }
  }
}

/** Validates all changes in a chain share the same epochId. */
export function validateEpochConsistent(changes: readonly CoordinationChange[]): void {
  if (changes.length === 0) {
    return;
  }
  const epoch = changes[0]?.epochId;
  for (const change of changes) {
    if (change.epochId !== epoch) {
      throw new Error(
        `epoch mismatch at ${change.changeId}: expected ${epoch}, got ${change.epochId}`,
      );
    }
  }
}

/**
 * Ensures snapshot.auditTail matches observation segments in RunHistory.
 * Runtime must keep both views aligned when recording external input.
 */
export function validateAuditTailMatchesHistory(
  snapshot: CollaborationSnapshot,
  history: RunHistory,
): void {
  const fromHistory = observationSegments(history);
  const fromSnapshot = snapshot.auditTail;

  if (fromHistory.length !== fromSnapshot.length) {
    throw new Error(
      `auditTail/history observation count mismatch: snapshot=${fromSnapshot.length}, history=${fromHistory.length}`,
    );
  }

  for (let i = 0; i < fromHistory.length; i++) {
    const left = fromHistory[i];
    const right = fromSnapshot[i];
    if (left === undefined || right === undefined) {
      continue;
    }
    assertObservationEntryEqual(left, right, i);
  }
}

function assertObservationEntryEqual(
  left: ObservationEntry,
  right: ObservationEntry,
  index: number,
): void {
  if (
    left.sequenceNo !== right.sequenceNo ||
    left.payloadRef !== right.payloadRef ||
    left.receivedAt !== right.receivedAt ||
    left.source.actorId !== right.source.actorId ||
    left.source.kind !== right.source.kind
  ) {
    throw new Error(`auditTail/history observation mismatch at index ${index}`);
  }
}
