import { expect } from "vitest";
import type { CollaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import type { CoordinationChange } from "../../../src/coordination/coordinationChange.js";
import {
  deriveCompositionView,
  deriveSnapshotStats,
} from "../../../src/structure/derive.js";
import type { RunHistory } from "../../../src/structure/trace.js";

/** I1: observation append must not mutate collaboration graph maps. */
export function assertObservationSeparation(
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
): void {
  expect(after.participants).toEqual(before.participants);
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.links).toEqual(before.links);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.capabilities).toEqual(before.capabilities);
}

/** CoordinationChange deliberately carries no payload field. */
export function assertNoPayload(change: CoordinationChange): void {
  expect("payload" in change).toBe(false);
}

/** I4: derive helpers must not mutate the snapshot. */
export function assertDeriveReadOnly(
  snapshot: CollaborationSnapshot,
  history: RunHistory,
): void {
  const participantsSize = snapshot.participants.size;
  const artifactsSize = snapshot.artifacts.size;
  const linksSize = snapshot.links.size;
  const auditTailLength = snapshot.auditTail.length;

  deriveCompositionView(snapshot, history);
  deriveSnapshotStats(snapshot);

  expect(snapshot.participants.size).toBe(participantsSize);
  expect(snapshot.artifacts.size).toBe(artifactsSize);
  expect(snapshot.links.size).toBe(linksSize);
  expect(snapshot.auditTail.length).toBe(auditTailLength);
}

/** I2: committed changes form a beforeRef chain when provided in order. */
export function assertBeforeRefChain(changes: readonly CoordinationChange[]): void {
  for (let i = 1; i < changes.length; i++) {
    const prev = changes[i - 1];
    const curr = changes[i];
    if (prev !== undefined && curr !== undefined) {
      expect(curr.beforeRef).toBe(prev.afterRef);
    }
  }
}

/** I5: all changes in a chain share the same epochId. */
export function assertEpochConsistent(changes: readonly CoordinationChange[]): void {
  if (changes.length === 0) {
    return;
  }
  const epoch = changes[0]?.epochId;
  for (const change of changes) {
    expect(change.epochId).toBe(epoch);
  }
}
