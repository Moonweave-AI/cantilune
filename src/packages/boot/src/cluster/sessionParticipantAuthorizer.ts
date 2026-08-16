/**
 * Authorizer: deny by default; allow session members for messaging actions.
 */
import { type Result, ok, err } from "@cantilune/core";
import type { CommsAuthorizer, CommsViolation, SessionAuthority } from "@cantilune/comms";
import { commsViolation } from "@cantilune/comms";

export function createSessionParticipantAuthorizer(
  sessionAuthority: SessionAuthority,
): CommsAuthorizer {
  return {
    authorize(input) {
      const sessionId = input.resource;
      if (sessionId === undefined || sessionId.length === 0) {
        return err(
          commsViolation("session_not_authorized", "authorize", "session resource required"),
        ) as Result<never, CommsViolation>;
      }
      const actor = input.context.peer.principal;
      if (
        sessionAuthority.isMember(sessionId as never, actor) ||
        sessionAuthority.isController(sessionId as never, actor)
      ) {
        return ok(undefined);
      }
      return err(
        commsViolation(
          "session_not_authorized",
          "authorize",
          "actor is not a session participant",
        ),
      ) as Result<never, CommsViolation>;
    },
  };
}
