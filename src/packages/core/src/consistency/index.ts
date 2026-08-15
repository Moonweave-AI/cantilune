import type { CollaborationSnapshot } from "../coordination/collaborationSnapshot.js";
import type { ObservationEntry } from "../nodes/observationEntry.js";
import { coreViolation, throwCore } from "../primitives/violation.js";
import { observationSegments, type UnvalidatedTrace } from "../structure/trace.js";
import { validateSnapshotIntegrityResult } from "./snapshotIntegrity.js";

export {
  validateBeforeRefChain,
  validateBeforeRefChainResult,
  validateEpochConsistent,
  validateEpochConsistentResult,
} from "../coordination/validation.js";

export { validateSnapshotIntegrity, validateSnapshotIntegrityResult } from "./snapshotIntegrity.js";

/**
 * Ensures snapshot.auditTail matches observation segments in RunHistory.
 * Runtime must keep both views aligned when recording external input.
 */
export function validateAuditTailMatchesHistory(
  snapshot: CollaborationSnapshot,
  history: UnvalidatedTrace,
): void {
  const result = validateAuditTailMatchesHistoryResult(snapshot, history);
  if (!result.ok) {
    throwCore(result.error);
  }
}

export function validateAuditTailMatchesHistoryResult(
  snapshot: CollaborationSnapshot,
  history: UnvalidatedTrace,
): { ok: true } | { ok: false; error: ReturnType<typeof coreViolation> } {
  const fromHistory = observationSegments(history);
  const fromSnapshot = snapshot.auditTail;

  if (fromHistory.length !== fromSnapshot.length) {
    return {
      ok: false,
      error: coreViolation(
        "audit_tail_history_mismatch",
        `auditTail/history observation count mismatch: snapshot=${fromSnapshot.length}, history=${fromHistory.length}`,
      ),
    };
  }

  for (let i = 0; i < fromHistory.length; i++) {
    const left = fromHistory[i];
    const right = fromSnapshot[i];
    if (left === undefined || right === undefined) {
      continue;
    }
    const mismatch = observationEntryMismatch(left, right);
    if (mismatch !== undefined) {
      return {
        ok: false,
        error: coreViolation(
          "audit_tail_history_mismatch",
          `auditTail/history observation mismatch at index ${i}: ${mismatch}`,
          { path: `auditTail[${i}]` },
        ),
      };
    }
  }
  return { ok: true };
}

function observationEntryMismatch(
  left: ObservationEntry,
  right: ObservationEntry,
): string | undefined {
  if (left.sequenceNo !== right.sequenceNo) {
    return "sequenceNo";
  }
  if (left.payloadRef !== right.payloadRef) {
    return "payloadRef";
  }
  if (left.receivedAt !== right.receivedAt) {
    return "receivedAt";
  }
  if (left.source.actorId !== right.source.actorId) {
    return "source.actorId";
  }
  if (left.source.kind !== right.source.kind) {
    return "source.kind";
  }
  return undefined;
}

/** Convenience: snapshot integrity + optional auditTail/history alignment. */
export function validateCollaborationWorld(
  snapshot: CollaborationSnapshot,
  history?: UnvalidatedTrace,
): void {
  const integrity = validateSnapshotIntegrityResult(snapshot);
  if (!integrity.ok) {
    throwCore(integrity.error);
  }
  if (history !== undefined) {
    validateAuditTailMatchesHistory(snapshot, history);
  }
}
