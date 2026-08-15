import {
  collaborationSnapshot,
  type CollaborationSnapshot,
  type SnapshotRef,
} from "@cantilune/core";
import type { CollaborationStore } from "../ports/collaborationStore.js";

export interface MemoryStoreOptions {
  readonly initial?: CollaborationSnapshot;
}

export class MemoryCollaborationStore implements CollaborationStore {
  private readonly snapshots = new Map<SnapshotRef, CollaborationSnapshot>();
  private headRef: SnapshotRef | undefined;

  constructor(options: MemoryStoreOptions = {}) {
    if (options.initial !== undefined) {
      const stored = collaborationSnapshot(options.initial);
      this.snapshots.set(stored.snapshotRef, stored);
      this.headRef = stored.snapshotRef;
    }
  }

  get(ref: SnapshotRef): CollaborationSnapshot | undefined {
    const stored = this.snapshots.get(ref);
    return stored === undefined ? undefined : collaborationSnapshot(stored);
  }

  put(snapshot: CollaborationSnapshot): boolean {
    const stored = collaborationSnapshot(snapshot);
    this.snapshots.set(stored.snapshotRef, stored);
    this.headRef = stored.snapshotRef;
    return true;
  }

  putIfAbsent(snapshot: CollaborationSnapshot): boolean {
    if (this.snapshots.has(snapshot.snapshotRef)) {
      return false;
    }
    this.snapshots.set(snapshot.snapshotRef, collaborationSnapshot(snapshot));
    return true;
  }

  setHead(ref: SnapshotRef): void {
    this.headRef = ref;
  }

  remove(ref: SnapshotRef): void {
    this.snapshots.delete(ref);
    if (this.headRef === ref) {
      this.headRef = undefined;
    }
  }

  head(): SnapshotRef | undefined {
    return this.headRef;
  }

  compareAndSwapHead(expected: SnapshotRef, snapshot: CollaborationSnapshot): boolean {
    if (this.headRef !== expected) {
      return false;
    }
    const stored = collaborationSnapshot(snapshot);
    this.snapshots.set(stored.snapshotRef, stored);
    this.headRef = stored.snapshotRef;
    return true;
  }

  allSnapshots(): readonly CollaborationSnapshot[] {
    return Object.freeze(
      [...this.snapshots.values()].map((snapshot) => collaborationSnapshot(snapshot)),
    );
  }

  allRefs(): readonly SnapshotRef[] {
    return Object.freeze([...this.snapshots.keys()]);
  }
}
