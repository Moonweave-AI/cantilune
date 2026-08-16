import {
  DEFAULT_NAMESPACE_ID,
  summarizeTranscript,
  visibleTranscript,
  type ActorId,
  type CollaborationSnapshot,
  type NamespaceId,
  type TranscriptVisibility,
} from "@cantilune/core";

export interface FleetNamespaceProjection {
  readonly namespaceId: NamespaceId;
  readonly displayName: string;
  readonly participantCount: number;
  readonly transcriptCount: number;
}

export interface FleetTranscriptProjection {
  readonly actorId: ActorId;
  readonly namespaceId: NamespaceId;
  readonly visibility: TranscriptVisibility;
}

/**
 * Cross-namespace fleet console: metadata + summaries only (ADR-0022).
 * Super-admin does not auto-see full transcripts; a `transcript_read` grant is required.
 */
export interface FleetConsoleProjection {
  readonly namespaces: readonly FleetNamespaceProjection[];
  readonly transcripts: readonly FleetTranscriptProjection[];
}

function hasTranscriptReadGrant(
  snapshot: CollaborationSnapshot,
  reader: ActorId,
  subject: ActorId,
): boolean {
  for (const capability of snapshot.capabilities.values()) {
    if (
      capability.kind === "transcript_read" &&
      capability.holder === reader &&
      capability.scope.kind === "transcript" &&
      capability.scope.actorId === subject
    ) {
      return true;
    }
  }
  for (const request of snapshot.transcriptAccessRequests.values()) {
    if (
      request.status === "approved" &&
      request.requester.actorId === reader &&
      request.subjectActorId === subject
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fleet views never treat same-namespace or self as an automatic full-text grant.
 * `visibleTranscript` still supplies absence / summary shaping; full text requires a grant.
 */
export function fleetVisibleTranscript(
  snapshot: CollaborationSnapshot,
  reader: ActorId,
  subject: ActorId,
): TranscriptVisibility {
  const visibility = visibleTranscript(snapshot, reader, subject);
  if (visibility.kind === "full" && !hasTranscriptReadGrant(snapshot, reader, subject)) {
    return { kind: "summary", transcript: summarizeTranscript(visibility.transcript) };
  }
  return visibility;
}

export function projectFleetConsole(
  snapshot: CollaborationSnapshot,
  reader: ActorId,
): FleetConsoleProjection {
  const namespaces = [...snapshot.namespaces.values()]
    .map((namespace) => {
      let participantCount = 0;
      for (const participant of snapshot.participants.values()) {
        const namespaceId = participant.namespaceId ?? DEFAULT_NAMESPACE_ID;
        if (namespaceId === namespace.namespaceId) {
          participantCount += 1;
        }
      }
      let transcriptCount = 0;
      for (const transcript of snapshot.transcripts.values()) {
        if (transcript.namespaceId === namespace.namespaceId) {
          transcriptCount += 1;
        }
      }
      return {
        namespaceId: namespace.namespaceId,
        displayName: namespace.displayName,
        participantCount,
        transcriptCount,
      };
    })
    .sort((left, right) => (left.namespaceId as string).localeCompare(right.namespaceId as string));

  const transcripts = [...snapshot.transcripts.entries()]
    .sort(([left], [right]) => (left as string).localeCompare(right as string))
    .map(([actorId, transcript]) => ({
      actorId,
      namespaceId: transcript.namespaceId,
      visibility: fleetVisibleTranscript(snapshot, reader, actorId),
    }));

  return { namespaces, transcripts };
}
