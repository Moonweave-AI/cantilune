import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  LinkId,
  SessionId,
} from "../primitives/ids.js";
import type { TargetRef } from "../primitives/refs.js";
import type { CoordinationChange, CoordinationIntent } from "../coordination/coordinationChange.js";
import type { CompositionIntent } from "./operators.js";
import type { Footprint } from "./boundary.js";
import { footprint } from "./boundary.js";

export function disjoint(a: Footprint, b: Footprint): boolean {
  return (
    !setsOverlap(a.artifactIds, b.artifactIds) &&
    !setsOverlap(a.participantIds, b.participantIds) &&
    !setsOverlap(a.sessionIds, b.sessionIds) &&
    !setsOverlap(a.capabilityIds, b.capabilityIds) &&
    !setsOverlap(a.linkIds, b.linkIds)
  );
}

export function overlaps(a: Footprint, b: Footprint): boolean {
  return !disjoint(a, b);
}

function setsOverlap<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  for (const value of a) {
    if (b.has(value)) {
      return true;
    }
  }
  return false;
}

export function footprintFromTargets(targets: readonly TargetRef[]): Footprint {
  const artifactIds: ArtifactId[] = [];
  const participantIds: ActorId[] = [];
  const sessionIds: SessionId[] = [];
  const capabilityIds: CapabilityId[] = [];
  const linkIds: LinkId[] = [];

  for (const target of targets) {
    switch (target.kind) {
      case "artifact":
        artifactIds.push(target.id as ArtifactId);
        break;
      case "participant":
        participantIds.push(target.id as ActorId);
        break;
      case "session":
        sessionIds.push(target.id as SessionId);
        break;
      case "capability":
        capabilityIds.push(target.id as CapabilityId);
        break;
      case "link":
        linkIds.push(target.id as LinkId);
        break;
    }
  }

  return footprint({ artifactIds, participantIds, sessionIds, capabilityIds, linkIds });
}

export function footprintOfChange(change: CoordinationChange): Footprint {
  const fp = footprintFromTargets(change.targets);
  return mergeSessionFootprint(fp, change.createdSessionRefs);
}

export function footprintOfCoordinationIntent(intent: CoordinationIntent): Footprint {
  return footprintFromTargets(intent.targets);
}

export function footprintOfCompositionIntent(intent: CompositionIntent): Footprint {
  return intent.footprint;
}

function mergeSessionFootprint(
  fp: Footprint,
  sessionRefs: readonly SessionId[],
): Footprint {
  if (sessionRefs.length === 0) {
    return fp;
  }
  return footprint({
    artifactIds: fp.artifactIds,
    participantIds: fp.participantIds,
    sessionIds: [...fp.sessionIds, ...sessionRefs],
    capabilityIds: fp.capabilityIds,
    linkIds: fp.linkIds,
  });
}

/** Two composition intents may proceed concurrently when their footprints are disjoint. */
export function compatibleConcurrently(a: CompositionIntent, b: CompositionIntent): boolean {
  return disjoint(a.footprint, b.footprint);
}
