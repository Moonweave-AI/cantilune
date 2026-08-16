import {
  collaborationSnapshot,
  summarizeTranscript,
  visibleTranscript,
  type ActorId,
  type CollaborationSnapshot,
  type TranscriptVisibility,
} from "@cantilune/core";
import {
  requireAccessContext,
  type ObservationAccessContext,
} from "../input/observationAccessContext.js";
import type { FourViewBundle } from "../index/fourViewBundle.js";

/**
 * Four-view read model plus namespace/grant-redacted transcripts (ADR-0022 / ADR-0025).
 * Views are passed through; transcript bodies follow `visibleTranscript`.
 */
export interface RedactedFourViewBundle {
  readonly bundle: FourViewBundle;
  readonly transcripts: ReadonlyMap<ActorId, TranscriptVisibility>;
  /** Snapshot with out-of-scope plaintext transcripts stripped. */
  readonly snapshot: CollaborationSnapshot;
}

function subjectActorIds(
  snapshot: CollaborationSnapshot,
  access: ObservationAccessContext,
): readonly ActorId[] {
  const scoped = access.scope.participantIds;
  const subjects = new Set<ActorId>();
  for (const actorId of snapshot.transcripts.keys()) {
    if (scoped.size === 0 || scoped.has(actorId)) {
      subjects.add(actorId);
    }
  }
  if (scoped.size > 0) {
    for (const actorId of scoped) {
      subjects.add(actorId);
    }
  }
  return [...subjects];
}

function snapshotWithVisibleTranscripts(
  snapshot: CollaborationSnapshot,
  transcripts: ReadonlyMap<ActorId, TranscriptVisibility>,
): CollaborationSnapshot {
  const visible = new Map(
    [...transcripts.entries()].flatMap(([actorId, visibility]) => {
      if (visibility.kind === "absent") {
        return [];
      }
      return [[actorId, visibility.transcript] as const];
    }),
  );
  return collaborationSnapshot({
    ...snapshot,
    transcripts: visible,
  });
}

/**
 * Same-namespace readers see full transcripts; cross-namespace readers see
 * `summarizeTranscript` unless a `transcript_read` grant is approved.
 */
export function redactFourViewBundle(
  bundle: FourViewBundle,
  access: ObservationAccessContext,
  snapshot: CollaborationSnapshot,
): RedactedFourViewBundle {
  const context = requireAccessContext(access);
  const reader = context.principal.actorId;
  const transcripts = new Map<ActorId, TranscriptVisibility>();
  for (const subject of subjectActorIds(snapshot, context)) {
    const original = snapshot.transcripts.get(subject);
    const visibility = visibleTranscript(snapshot, reader, subject);
    if (visibility.kind === "summary" && original !== undefined) {
      transcripts.set(subject, { kind: "summary", transcript: summarizeTranscript(original) });
      continue;
    }
    transcripts.set(subject, visibility);
  }
  return {
    bundle,
    transcripts,
    snapshot: snapshotWithVisibleTranscripts(snapshot, transcripts),
  };
}
