import {
  type CollaborationSnapshot,
  type CommunicationSession,
  type SessionId,
} from "@cantilune/core";
import { type EventTag } from "../../foundation/eventTag.js";
import { type CommunicationDelta } from "../../spine/projectionSlice.js";

function sessionChanged(before: CommunicationSession, after: CommunicationSession): boolean {
  if (before.controller !== after.controller || before.visibility !== after.visibility) {
    return true;
  }
  if (before.participants.length !== after.participants.length) {
    return true;
  }
  return before.participants.some(
    (participant, index) => participant !== after.participants[index],
  );
}

export function interpretCommunicationDelta(
  eventTag: EventTag,
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
): CommunicationDelta {
  const openedSessions = [...after.sessions.values()].filter(
    (session) => !before.sessions.has(session.sessionId),
  );
  const closedSessionIds: SessionId[] = [];
  for (const sessionId of before.sessions.keys()) {
    if (!after.sessions.has(sessionId)) {
      closedSessionIds.push(sessionId);
    }
  }
  const updatedSessions: CommunicationSession[] = [];
  for (const [sessionId, afterSession] of after.sessions) {
    const beforeSession = before.sessions.get(sessionId);
    if (beforeSession !== undefined && sessionChanged(beforeSession, afterSession)) {
      updatedSessions.push(afterSession);
    }
  }
  return {
    eventTag,
    openedSessions,
    closedSessionIds,
    updatedSessions,
  };
}
