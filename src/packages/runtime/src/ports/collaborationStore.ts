import type { CollaborationSnapshot } from "@cantilune/core";
import type { SnapshotRef } from "@cantilune/core";

export interface CollaborationStore {
  get(ref: SnapshotRef): CollaborationSnapshot | undefined;
  put(snapshot: CollaborationSnapshot): boolean;
  head(): SnapshotRef | undefined;
  compareAndSwapHead?(expected: SnapshotRef, snapshot: CollaborationSnapshot): boolean;
}
