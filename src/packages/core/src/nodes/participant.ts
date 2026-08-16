import { DEFAULT_NAMESPACE_ID, type ActorId, type NamespaceId } from "../primitives/ids.js";
import type { ContentRef } from "../primitives/refs.js";
import { err, ok, type Result } from "../primitives/result.js";

/**
 * Category of participant in the collaboration world.
 *
 * Enumerated as a value so decoders can validate against it instead of keeping
 * their own copy. A hand-copied list in the snapshot wire validator fell two
 * members behind this one, and the store then accepted commits it could never
 * read back.
 */
export const ACTOR_KINDS = [
  "human",
  "agent",
  "tool",
  "reviewer",
  "runtime",
  "environment",
] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];

/** Lifecycle state of a registered participant in the collaboration world. */
export const PARTICIPATION_STATUSES = [
  "registered",
  "active",
  "waiting",
  "blocked",
  "done",
  "retired",
] as const;

export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

/**
 * Permanent registration of an actor in the collaboration world (Config.nodes).
 * Distinct from ActorRef, which is the event-side attribution view.
 *
 * `manifestRef` is the content-addressed reference to the participant's
 * `AgentManifest`. It is absent for non-agent participants and for agents that
 * have not yet been activated; an `agent` participant carries it once `active`.
 * Binding the manifest reference on the participant (rather than scanning the
 * audit tail for it) is the canonical Manifest binding of ADR-0015.
 */
export interface Participant {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
  readonly status: ParticipationStatus;
  readonly namespaceId?: NamespaceId;
  readonly manifestRef?: ContentRef;
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
  manifestRef?: ContentRef,
  namespaceId: NamespaceId = DEFAULT_NAMESPACE_ID,
): Participant {
  const base: Participant = { actorId, kind, status, namespaceId };
  if (manifestRef !== undefined) {
    return { ...base, manifestRef };
  }
  return base;
}

export function actorRef(actorId: ActorId, kind: ActorKind): ActorRef {
  return { actorId, kind };
}

export type ResolveActorRefError =
  | { readonly kind: "not_found"; readonly actorId: ActorId }
  | {
      readonly kind: "kind_mismatch";
      readonly actorId: ActorId;
      readonly expected: ActorKind;
      readonly actual: ActorKind;
    };

/** Resolve ActorRef against a participant registry with kind consistency check. */
export function resolveActorRef(
  ref: ActorRef,
  participants: ReadonlyMap<ActorId, Participant>,
): Result<Participant, ResolveActorRefError> {
  const found = participants.get(ref.actorId);
  if (found === undefined) {
    return err({ kind: "not_found", actorId: ref.actorId });
  }
  if (found.kind !== ref.kind) {
    return err({
      kind: "kind_mismatch",
      actorId: ref.actorId,
      expected: ref.kind,
      actual: found.kind,
    });
  }
  return ok(found);
}

/** Lenient lookup by id only — prefer {@link resolveActorRef} at admission boundaries. */
export function lookupParticipantById(
  actorId: ActorId,
  participants: ReadonlyMap<ActorId, Participant>,
): Participant | undefined {
  return participants.get(actorId);
}
