import type { CollaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import type { CoordinationChange } from "../../../src/coordination/coordinationChange.js";
import type { RunHistory } from "../../../src/structure/trace.js";
import { appendRewriteSegment } from "../../../src/structure/trace.js";

export interface CommitResult {
  readonly after: CollaborationSnapshot;
  readonly history: RunHistory;
}

/**
 * Package-internal commit harness: apply a snapshot transition and record rewrite history.
 * Full admission/replay lives in @cantilune/runtime (future).
 */
export function simulateCommit(
  before: CollaborationSnapshot,
  history: RunHistory,
  change: CoordinationChange,
  apply: (snap: CollaborationSnapshot, change: CoordinationChange) => CollaborationSnapshot,
): CommitResult {
  const after = apply(before, change);
  return {
    after,
    history: appendRewriteSegment(history, change),
  };
}
