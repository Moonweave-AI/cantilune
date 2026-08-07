import type { ActorId, SessionId } from "../primitives/ids.js";

/** Whether a communication session is private to its members or shared more broadly. */
export type SessionVisibility = "private" | "shared";

/** Scoped communication channel (π-calculus session analogue). */
export interface CommunicationSession {
  readonly sessionId: SessionId;
  readonly controller: ActorId;
  readonly participants: readonly ActorId[];
  readonly visibility: SessionVisibility;
}

export function communicationSession(
  sessionId: SessionId,
  controller: ActorId,
  participants: readonly ActorId[],
  visibility: SessionVisibility = "private",
): CommunicationSession {
  return { sessionId, controller, participants, visibility };
}
