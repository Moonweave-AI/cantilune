import type { ChangeId, CoordinationChange, SnapshotRef } from "@cantilune/core";

export interface ChangeLog {
  append(change: CoordinationChange): boolean;
  get(changeId: ChangeId): CoordinationChange | undefined;
  since(beforeRef: SnapshotRef): readonly CoordinationChange[];
  all(): readonly CoordinationChange[];
}
