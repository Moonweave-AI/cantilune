import type { ObservationEntry } from "../nodes/observationEntry.js";
import type { CoordinationChange } from "../coordination/coordinationChange.js";
import type { Footprint } from "./boundary.js";
import { footprintFromTargets } from "./isolation.js";

/** One segment of a run history — external observation or committed rewrite. */
export type TraceSegment =
  | { readonly kind: "observation"; readonly entry: ObservationEntry }
  | { readonly kind: "rewrite"; readonly change: CoordinationChange };

export type RunHistory = readonly TraceSegment[];

export function emptyRunHistory(): RunHistory {
  return [];
}

export function appendTraceSegment(history: RunHistory, segment: TraceSegment): RunHistory {
  return [...history, segment];
}

export function appendObservationSegment(
  history: RunHistory,
  entry: ObservationEntry,
): RunHistory {
  return appendTraceSegment(history, { kind: "observation", entry });
}

export function appendRewriteSegment(
  history: RunHistory,
  change: CoordinationChange,
): RunHistory {
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
  return footprintFromTargets(segment.change.targets);
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
