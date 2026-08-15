import type { ObservationEntry } from "../nodes/observationEntry.js";
import type { CoordinationChange } from "../coordination/coordinationChange.js";
import type { Footprint } from "./boundary.js";
import { footprintFromTargets, footprintOfChange } from "./isolation.js";
import { coreViolation, throwCore } from "../primitives/violation.js";
import { validateBeforeRefChain, validateEpochConsistent } from "../coordination/validation.js";

/** One segment of a run history — external observation or committed rewrite. */
export type TraceSegment =
  | { readonly kind: "observation"; readonly entry: ObservationEntry }
  | { readonly kind: "rewrite"; readonly change: CoordinationChange };

/** Unvalidated append-only trace; may contain gaps until validated. */
export type UnvalidatedTrace = readonly TraceSegment[];

/** @deprecated Alias for {@link UnvalidatedTrace}. Prefer explicit validation before replay. */
export type RunHistory = UnvalidatedTrace;

/** Trace that passed structural validation (chain, epoch, observation order). */
export interface ValidatedRunHistory {
  readonly kind: "validated";
  readonly segments: readonly TraceSegment[];
}

export function emptyRunHistory(): RunHistory {
  return [];
}

export function appendTraceSegment(history: RunHistory, segment: TraceSegment): RunHistory {
  return [...history, segment];
}

export function appendObservationSegment(history: RunHistory, entry: ObservationEntry): RunHistory {
  return appendTraceSegment(history, { kind: "observation", entry });
}

export function appendRewriteSegment(history: RunHistory, change: CoordinationChange): RunHistory {
  return appendTraceSegment(history, { kind: "rewrite", change });
}

export function composeSerialHistory(first: RunHistory, second: RunHistory): RunHistory {
  return [...first, ...second];
}

function segmentFootprint(segment: TraceSegment): Footprint {
  if (segment.kind === "observation") {
    return footprintFromTargets([
      { kind: "participant", id: segment.entry.source.actorId as string },
    ]);
  }
  return footprintOfChange(segment.change);
}

/** Extract history segments whose footprint overlaps the given scope. */
export function sliceRunHistory(history: RunHistory, scope: Footprint): RunHistory {
  return history.filter((segment) => footprintsOverlap(segmentFootprint(segment), scope));
}

function footprintsOverlap(a: Footprint, b: Footprint): boolean {
  return (
    setsOverlap(a.artifactIds, b.artifactIds) ||
    setsOverlap(a.participantIds, b.participantIds) ||
    setsOverlap(a.sessionIds, b.sessionIds) ||
    setsOverlap(a.capabilityIds, b.capabilityIds) ||
    setsOverlap(a.linkIds, b.linkIds)
  );
}

function setsOverlap<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  for (const value of a) {
    if (b.has(value)) {
      return true;
    }
  }
  return false;
}

export function rewriteSegments(history: RunHistory): readonly CoordinationChange[] {
  return history
    .filter((s): s is Extract<TraceSegment, { kind: "rewrite" }> => s.kind === "rewrite")
    .map((s) => s.change);
}

export function observationSegments(history: RunHistory): readonly ObservationEntry[] {
  return history
    .filter((s): s is Extract<TraceSegment, { kind: "observation" }> => s.kind === "observation")
    .map((s) => s.entry);
}

/** Validate observation monotonic sequence inside a trace slice. */
export function validateObservationSequence(history: RunHistory): void {
  let expected = 1;
  for (const segment of history) {
    if (segment.kind !== "observation") {
      continue;
    }
    if (segment.entry.sequenceNo !== expected) {
      throwCore(
        coreViolation(
          "observation_sequence_invalid",
          `expected observation sequence ${expected}, got ${segment.entry.sequenceNo}`,
          { expected: String(expected), actual: String(segment.entry.sequenceNo) },
        ),
      );
    }
    expected += 1;
  }
}

/**
 * Promote an unvalidated trace after rewrite chain and observation order checks.
 * Does not validate snapshot integrity — call {@link validateCollaborationWorld} separately.
 */
export function validateRunHistory(history: RunHistory): ValidatedRunHistory {
  validateObservationSequence(history);
  const changes = rewriteSegments(history);
  if (changes.length > 0) {
    validateBeforeRefChain(changes);
    validateEpochConsistent(changes);
  }
  return { kind: "validated", segments: history };
}
