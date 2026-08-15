import {
  type ChangeId,
  type CollaborationSnapshot,
  type CoordinationChange,
  type ValidatedRunHistory,
  type SnapshotRef,
} from "@cantilune/core";

/** Read-only coordination world at terminal snapshot + indexed changes. */
export interface ObservationWorld {
  readonly snapshotRef: SnapshotRef;
  readonly snapshot: CollaborationSnapshot;
  readonly validatedHistory: ValidatedRunHistory;
  readonly orderedChanges: readonly CoordinationChange[];
  readonly changeIndex: ReadonlyMap<ChangeId, CoordinationChange>;
  readonly sinceRef: SnapshotRef;
}

export function observationWorld(init: {
  readonly snapshotRef: SnapshotRef;
  readonly snapshot: CollaborationSnapshot;
  readonly validatedHistory: ValidatedRunHistory;
  readonly changes: readonly CoordinationChange[];
  readonly sinceRef: SnapshotRef;
}): ObservationWorld {
  const changeIndex = new Map<ChangeId, CoordinationChange>();
  for (const change of init.changes) {
    if (changeIndex.has(change.changeId)) {
      throw new Error(`duplicate changeId ${change.changeId} in observation world`);
    }
    changeIndex.set(change.changeId, change);
  }
  return {
    snapshotRef: init.snapshotRef,
    snapshot: init.snapshot,
    validatedHistory: init.validatedHistory,
    orderedChanges: init.changes,
    changeIndex,
    sinceRef: init.sinceRef,
  };
}

export function resolveSnapshotFromWorld(
  world: ObservationWorld,
  ref: SnapshotRef,
): CollaborationSnapshot | undefined {
  if (world.snapshot.snapshotRef === ref) {
    return world.snapshot;
  }
  return undefined;
}
