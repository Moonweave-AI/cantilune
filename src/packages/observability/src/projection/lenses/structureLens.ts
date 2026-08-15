import {
  diagnosticStepFromChange,
  type CollaborationSnapshot,
  type CoordinationChange,
  type DerivedDiagnosticView,
} from "@cantilune/core";
import { type EventTag } from "../../foundation/eventTag.js";
import { type StructureDelta } from "../../spine/projectionSlice.js";
import { addedLinks, isStructuralLinkKind, removedLinkIds, updatedLinks } from "../linkFilters.js";

/** Per-change structure step — aligned with core {@link diagnosticStepFromChange}. */
export { diagnosticStepFromChange as structureStepFromChange } from "@cantilune/core";

export function interpretStructureDelta(
  eventTag: EventTag,
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
  change: CoordinationChange,
): StructureDelta {
  return {
    eventTag,
    step: diagnosticStepFromChange(change),
    structuralLinks: addedLinks(before.links, after.links, isStructuralLinkKind),
    updatedStructuralLinks: updatedLinks(before.links, after.links, isStructuralLinkKind),
    removedStructuralLinkIds: removedLinkIds(before.links, after.links, isStructuralLinkKind),
  };
}

export function compositionFromSnapshot(snapshot: CollaborationSnapshot): DerivedDiagnosticView {
  const participants = [...snapshot.participants.values()].sort((left, right) =>
    left.actorId.localeCompare(right.actorId),
  );
  if (participants.length === 0) {
    return { kind: "box" };
  }
  if (participants.length === 1) {
    const participant = participants[0];
    if (participant !== undefined) {
      return { kind: "box", participantId: participant.actorId };
    }
  }
  return {
    kind: "parallel",
    parts: participants.map((participant) => ({
      kind: "box" as const,
      participantId: participant.actorId,
    })),
  };
}

export function foldStructureComposition(
  steps: readonly DerivedDiagnosticView[],
  snapshot: CollaborationSnapshot,
): DerivedDiagnosticView {
  if (steps.length === 0) {
    return compositionFromSnapshot(snapshot);
  }
  if (steps.length === 1) {
    return steps[0] ?? { kind: "box" };
  }
  return { kind: "serial", parts: steps };
}

export type { ActorId, ArtifactId } from "@cantilune/core";
