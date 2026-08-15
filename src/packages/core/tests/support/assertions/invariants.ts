import { expect } from "vitest";
import type { CollaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import type { CoordinationChange } from "../../../src/coordination/coordinationChange.js";
import {
  validateBeforeRefChain,
  validateEpochConsistent,
} from "../../../src/coordination/validation.js";
import { deriveDiagnosticSummary, deriveSnapshotStats } from "../../../src/structure/derive.js";
import type { UnvalidatedTrace } from "../../../src/structure/trace.js";

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
  history: UnvalidatedTrace,
): void {
  const participantsSize = snapshot.participants.size;
  const artifactsSize = snapshot.artifacts.size;
  const linksSize = snapshot.links.size;
  const auditTailLength = snapshot.auditTail.length;

  deriveDiagnosticSummary(snapshot, history);
  deriveSnapshotStats(snapshot);

  expect(snapshot.participants.size).toBe(participantsSize);
  expect(snapshot.artifacts.size).toBe(artifactsSize);
  expect(snapshot.links.size).toBe(linksSize);
  expect(snapshot.auditTail.length).toBe(auditTailLength);
}

/** I2/I5: use production validators. */
export function assertBeforeRefChain(changes: readonly CoordinationChange[]): void {
  validateBeforeRefChain(changes);
}

export function assertEpochConsistent(changes: readonly CoordinationChange[]): void {
  validateEpochConsistent(changes);
}

/** Detect shared-map aliasing after snapshot construction. */
export function assertSnapshotMapsNotAliased(
  snapshot: CollaborationSnapshot,
  sourceMap: ReadonlyMap<unknown, unknown>,
): void {
  expect(snapshot.participants).not.toBe(sourceMap);
}
