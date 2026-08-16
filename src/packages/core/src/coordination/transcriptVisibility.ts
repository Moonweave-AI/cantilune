import type { ActorId } from "../primitives/ids.js";
import { DEFAULT_NAMESPACE_ID } from "../primitives/ids.js";
import type { CollaborationSnapshot } from "./collaborationSnapshot.js";
import type { ParticipantTranscript } from "../nodes/participantTranscript.js";
import { summarizeTranscript } from "../nodes/participantTranscript.js";

export type TranscriptVisibility =
  | { readonly kind: "full"; readonly transcript: ParticipantTranscript }
  | { readonly kind: "summary"; readonly transcript: ParticipantTranscript }
  | { readonly kind: "absent" };

function namespaceOf(snapshot: CollaborationSnapshot, actorId: ActorId): string {
  return snapshot.participants.get(actorId)?.namespaceId ?? DEFAULT_NAMESPACE_ID;
}

function hasApprovedTranscriptRead(
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
 * Same-namespace peers see full transcripts. Cross-namespace readers see a
 * summary unless the subject approved a transcript_read grant (ADR-0021/0022).
 */
export function visibleTranscript(
  snapshot: CollaborationSnapshot,
  reader: ActorId,
  subject: ActorId,
): TranscriptVisibility {
  const transcript = snapshot.transcripts.get(subject);
  if (transcript === undefined) {
    return { kind: "absent" };
  }
  if (reader === subject || namespaceOf(snapshot, reader) === namespaceOf(snapshot, subject)) {
    return { kind: "full", transcript };
  }
  if (hasApprovedTranscriptRead(snapshot, reader, subject)) {
    return { kind: "full", transcript };
  }
  return { kind: "summary", transcript: summarizeTranscript(transcript) };
}
