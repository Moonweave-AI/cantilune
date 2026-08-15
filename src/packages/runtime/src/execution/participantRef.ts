import type { ActorId, ActorRef, CollaborationSnapshot } from "@cantilune/core";
import { actorRef } from "@cantilune/core";
import { runtimeViolation, throwRuntime } from "../foundation/errors.js";

/**
 * Resolves an actor's recorded kind for the evidence a handler is about to emit.
 *
 * Throws on an unknown actor rather than assuming `agent`. The refs built here
 * land in `CoordinationEvent.involved`, which is persisted and replayed, so a
 * guessed kind became permanent evidence about a participant that did not
 * exist — and stayed wrong even if that id was later registered as something
 * else. Handlers only run after admission has bound these ids, so a miss here
 * means an invariant is already broken and should surface at the commit that
 * broke it.
 */
export function actorRefFromSnapshot(snapshot: CollaborationSnapshot, actorId: ActorId): ActorRef {
  const participant = snapshot.participants.get(actorId);
  if (participant === undefined) {
    throwRuntime(
      runtimeViolation(
        "apply_failed",
        `cannot build an actor ref for "${actorId}": no such participant in the snapshot`,
        { path: "snapshot.participants" },
      ),
    );
  }
  return actorRef(actorId, participant.kind);
}

export function actorRefsFromSnapshot(
  snapshot: CollaborationSnapshot,
  actorIds: readonly ActorId[],
): ActorRef[] {
  return actorIds.map((id) => actorRefFromSnapshot(snapshot, id));
}
