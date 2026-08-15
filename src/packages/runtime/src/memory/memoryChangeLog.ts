import type { ChangeId, CoordinationChange, SnapshotRef } from "@cantilune/core";
import type { ChangeLog } from "../ports/changeLog.js";
import { snapshotCoordinationChange } from "../replay/authoritySnapshot.js";

export class MemoryChangeLog implements ChangeLog {
  private readonly changes: CoordinationChange[] = [];

  append(change: CoordinationChange): boolean {
    if (this.changes.some((existing) => existing.changeId === change.changeId)) {
      return false;
    }
    this.changes.push(snapshotCoordinationChange(change));
    return true;
  }

  get(changeId: ChangeId): CoordinationChange | undefined {
    const stored = this.changes.find((change) => change.changeId === changeId);
    return stored === undefined ? undefined : snapshotCoordinationChange(stored);
  }

  since(beforeRef: SnapshotRef): readonly CoordinationChange[] {
    const startIndex = this.changes.findIndex((change) => change.beforeRef === beforeRef);
    if (startIndex === -1) {
      const matching = this.changes.filter((change) => {
        const chain = this.buildChainFrom(beforeRef);
        return chain.some((c) => c.changeId === change.changeId);
      });
      return Object.freeze(matching.map(snapshotCoordinationChange));
    }
    return Object.freeze(this.changes.slice(startIndex).map(snapshotCoordinationChange));
  }

  all(): readonly CoordinationChange[] {
    return Object.freeze(this.changes.map(snapshotCoordinationChange));
  }

  private buildChainFrom(fromRef: SnapshotRef): CoordinationChange[] {
    const first = this.changes.find((change) => change.beforeRef === fromRef);
    if (first === undefined) {
      return [];
    }
    const chain: CoordinationChange[] = [first];
    let cursor = first.afterRef;
    while (true) {
      const next = this.changes.find((change) => change.beforeRef === cursor);
      if (next === undefined) {
        break;
      }
      chain.push(next);
      cursor = next.afterRef;
    }
    return chain;
  }
}
