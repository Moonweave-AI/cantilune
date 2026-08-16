import type { ActorId, NamespaceId, TranscriptAccessRequestId } from "../primitives/ids.js";
import type { ActorRef } from "./participant.js";

export const TRANSCRIPT_ACCESS_STATUSES = [
  "requested",
  "approved",
  "denied",
  "revoked",
] as const;

export type TranscriptAccessStatus = (typeof TRANSCRIPT_ACCESS_STATUSES)[number];

/**
 * Cross-namespace request to read another actor's full transcript (ADR-0022).
 * Only the subject actor may approve or deny.
 */
export interface TranscriptAccessRequest {
  readonly requestId: TranscriptAccessRequestId;
  readonly requester: ActorRef;
  readonly subjectActorId: ActorId;
  readonly subjectNamespaceId: NamespaceId;
  readonly status: TranscriptAccessStatus;
  readonly decidedBy?: ActorRef;
}

export function transcriptAccessRequest(
  requestId: TranscriptAccessRequestId,
  requester: ActorRef,
  subjectActorId: ActorId,
  subjectNamespaceId: NamespaceId,
  status: TranscriptAccessStatus = "requested",
  decidedBy?: ActorRef,
): TranscriptAccessRequest {
  const base: TranscriptAccessRequest = {
    requestId,
    requester,
    subjectActorId,
    subjectNamespaceId,
    status,
  };
  if (decidedBy !== undefined) {
    return { ...base, decidedBy };
  }
  return base;
}

export function decideTranscriptAccess(
  request: TranscriptAccessRequest,
  decidedBy: ActorRef,
  status: "approved" | "denied" | "revoked",
): TranscriptAccessRequest {
  return { ...request, status, decidedBy };
}

/** Subject actor is the only principal who may decide. */
export function canDecideTranscriptAccess(
  request: TranscriptAccessRequest,
  actorId: ActorId,
): boolean {
  return request.subjectActorId === actorId;
}
