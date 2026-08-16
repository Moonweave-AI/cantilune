import type { CollaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import type { CoordinationChange } from "../../../src/coordination/coordinationChange.js";
import type { RunHistory } from "../../../src/structure/trace.js";
import { appendRewriteSegment } from "../../../src/structure/trace.js";

export interface CommitResult {
  readonly after: CollaborationSnapshot;
  readonly history: RunHistory;
}

/**
 * @deprecated Not L6 evidence. Tests-only recipe harness — apply a snapshot
 * transition and record rewrite history. Prefer runtime admit/commit
 * (`@cantilune/runtime` integration/story-t0-to-delegate). Not a production export.
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
