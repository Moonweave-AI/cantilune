import {
  collaborationSnapshot,
  type CollaborationSnapshot,
  type EpochId,
  type SnapshotRef,
} from "@cantilune/core";
import { isEpochOnlyAdvance } from "../codec/observationBridge.js";

/** Pure schema admission: clone world content, advance epoch only. */
export function snapshotWithAdvancedEpoch(
  before: CollaborationSnapshot,
  afterRef: SnapshotRef,
  targetEpochId: EpochId,
): CollaborationSnapshot {
  return collaborationSnapshot({
    // Preserve the complete collaboration world. Explicitly enumerating
    // fields here made new canonical state (heartbeatLog) disappear during an
    // otherwise epoch-only transition.
    ...before,
    snapshotRef: afterRef,
    epochId: targetEpochId,
  });
}

export function snapshotsEqualExceptEpochAndRef(
  left: CollaborationSnapshot,
  right: CollaborationSnapshot,
): boolean {
  return isEpochOnlyAdvance(left, right);
}
