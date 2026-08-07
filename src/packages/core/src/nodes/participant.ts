import type { ActorId } from "../primitives/ids.js";

/** Category of participant in the collaboration world. */
export type ActorKind = "human" | "agent" | "tool" | "reviewer" | "runtime" | "environment";

/** Scheduling posture of a registered participant. */
export type ParticipationStatus = "active" | "waiting" | "blocked" | "retired";

/**
 * Permanent registration of an actor in the collaboration world (Config.nodes).
 * Distinct from ActorRef, which is the event-side attribution view.
 */
export interface Participant {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
  readonly status: ParticipationStatus;
}

/**
 * Event-side reference to a participant (DPOEvent initiator / involved).
 * Carries kind redundantly so change consumers need not resolve the full Participant map.
 */
export interface ActorRef {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
}

export function participant(
  actorId: ActorId,
  kind: ActorKind,
  status: ParticipationStatus = "active",
): Participant {
  return { actorId, kind, status };
}

export function actorRef(actorId: ActorId, kind: ActorKind): ActorRef {
  return { actorId, kind };
}

/** Resolve ActorRef against a participant registry. Implementation lives in runtime; signature only in core. */
export type ResolveActorRef = (
  ref: ActorRef,
  participants: ReadonlyMap<ActorId, Participant>,
) => Participant | undefined;

export const resolveActorRef: ResolveActorRef = (ref, participants) =>
  participants.get(ref.actorId);
