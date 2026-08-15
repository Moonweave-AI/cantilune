import { appendObservation, withSnapshotRef } from "@cantilune/core";
import type { CollaborationSnapshot, CoordinationChange, SnapshotRef } from "@cantilune/core";
import { snapshotsCanonicallyEqual } from "./canonicalSnapshot.js";

/**
 * Whether `to` is `from` plus appended observations and nothing else.
 *
 * Ingesting an observation allocates a fresh snapshot ref and swaps the head
 * without writing a `CoordinationChange` — deliberately, since an
 * `ObservationEntry` is not a change. The consequence is that consecutive
 * entries in the change log are not required to satisfy
 * `next.beforeRef === previous.afterRef`: an observation may sit between them.
 *
 * Nothing records that hop, so it is proven rather than assumed: the added
 * audit entries are replayed onto `from` and the result is compared with `to`.
 * A hop that changed anything else — a lost commit, a forked log, a tampered
 * snapshot — fails to reproduce and is reported as a broken chain.
 */
export function isObservationOnlyAdvance(
  from: CollaborationSnapshot,
  to: CollaborationSnapshot,
): boolean {
  if (to.auditTail.length <= from.auditTail.length) {
    return false;
  }

  let rebuilt = from;
  for (const entry of to.auditTail.slice(from.auditTail.length)) {
    rebuilt = appendObservation(rebuilt, {
      source: entry.source,
      payloadRef: entry.payloadRef,
      receivedAt: entry.receivedAt,
    });
  }

  return snapshotsCanonicallyEqual(withSnapshotRef(rebuilt, to.snapshotRef), to);
}

/**
 * Whether `to` is a schema-epoch activation snapshot and nothing else.
 *
 * Epoch administration advances the durable head without emitting a business
 * `CoordinationChange`.  That gap is safe to bridge only when both identity
 * fields advance and every field in the collaboration world is otherwise
 * canonically equal.  In particular, this does not bless an arbitrary
 * cross-epoch gap that also changes participants, artifacts, sessions,
 * observations, policy state, or heartbeat history.
 */
export function isEpochOnlyAdvance(
  from: CollaborationSnapshot,
  to: CollaborationSnapshot,
): boolean {
  if (from.snapshotRef === to.snapshotRef || from.epochId === to.epochId) {
    return false;
  }

  return snapshotsCanonicallyEqual(from, { ...to, epochId: from.epochId });
}

/**
 * Reproduce an observation append and epoch activation that both occurred
 * between business commits. The two administrative steps commute because an
 * observation never changes epoch and epoch activation never changes audit.
 */
export function isObservationAndEpochOnlyAdvance(
  from: CollaborationSnapshot,
  to: CollaborationSnapshot,
): boolean {
  if (
    from.snapshotRef === to.snapshotRef ||
    from.epochId === to.epochId ||
    to.auditTail.length <= from.auditTail.length
  ) {
    return false;
  }

  let rebuilt = from;
  for (const entry of to.auditTail.slice(from.auditTail.length)) {
    rebuilt = appendObservation(rebuilt, {
      source: entry.source,
      payloadRef: entry.payloadRef,
      receivedAt: entry.receivedAt,
    });
  }
  return snapshotsCanonicallyEqual(
    { ...rebuilt, snapshotRef: to.snapshotRef, epochId: to.epochId },
    to,
  );
}

/** Any fully reproduced head advance that intentionally has no business change. */
export function isVerifiableUnloggedAdvance(
  from: CollaborationSnapshot,
  to: CollaborationSnapshot,
): boolean {
  return (
    isObservationOnlyAdvance(from, to) ||
    isEpochOnlyAdvance(from, to) ||
    isObservationAndEpochOnlyAdvance(from, to)
  );
}

/**
 * Whether `change` legitimately continues from `previous`, directly or across
 * a strictly reproducible non-business head advance.
 */
export function changeContinuesChain(
  previous: CoordinationChange,
  change: CoordinationChange,
  resolve: (ref: SnapshotRef) => CollaborationSnapshot | undefined,
): boolean {
  if (change.beforeRef === previous.afterRef) {
    return true;
  }

  const from = resolve(previous.afterRef);
  const to = resolve(change.beforeRef);
  if (from === undefined || to === undefined) {
    return false;
  }

  return isVerifiableUnloggedAdvance(from, to);
}
