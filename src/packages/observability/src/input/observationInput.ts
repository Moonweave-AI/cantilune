import {
  type ChangeId,
  type CollaborationSnapshot,
  type CoordinationChange,
  type SnapshotRef,
  type UnvalidatedTrace,
  type ValidatedRunHistory,
} from "@cantilune/core";

/** Aggregated read ports from runtime after commit. */
export interface ObservationInput {
  readonly headRef: SnapshotRef;
  readonly sinceRef: SnapshotRef;
  readonly snapshot: CollaborationSnapshot;
  readonly changes: readonly CoordinationChange[];
  readonly validatedHistory: ValidatedRunHistory;
}

export interface SnapshotReader {
  get(ref: SnapshotRef): CollaborationSnapshot | undefined;
}

export interface ChangeLogReader {
  since(beforeRef: SnapshotRef): readonly CoordinationChange[];
}

export interface RunHistoryReader {
  current(): UnvalidatedTrace;
}

export interface ObservationReadPorts {
  head(): SnapshotRef | undefined;
  getSnapshot(ref: SnapshotRef): CollaborationSnapshot | undefined;
  changesSince(sinceRef: SnapshotRef): readonly CoordinationChange[];
  runHistory?(): UnvalidatedTrace;
}

export function createObservationReadPorts(deps: {
  readonly head: () => SnapshotRef | undefined;
  readonly getSnapshot: (ref: SnapshotRef) => CollaborationSnapshot | undefined;
  readonly changesSince: (sinceRef: SnapshotRef) => readonly CoordinationChange[];
  readonly runHistory?: () => UnvalidatedTrace;
}): ObservationReadPorts {
  return deps;
}

export function changeIdsInOrder(changes: readonly CoordinationChange[]): readonly ChangeId[] {
  return changes.map((change) => change.changeId);
}
