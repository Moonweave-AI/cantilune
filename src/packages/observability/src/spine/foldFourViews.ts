import { type EventTagIndex, createEventTagIndex } from "../foundation/eventTagIndex.js";
import { cloneSnapshotForObservation, sortById } from "../foundation/immutableBoundary.js";
import {
  filterLinksByKind,
  isDependencyLinkKind,
  isStructuralLinkKind,
} from "../projection/linkFilters.js";
import { foldStructureComposition } from "../projection/lenses/structureLens.js";
import { communicationView } from "../projection/views/communicationView.js";
import { dependencyView } from "../projection/views/dependencyView.js";
import { resourceView } from "../projection/views/resourceView.js";
import { structureView } from "../projection/views/structureView.js";
import {
  type ObservationVisibilityPolicy,
  defaultObservationVisibilityPolicy,
} from "../input/observationVisibility.js";
import { type ObservationWorld } from "../world/observationWorld.js";
import { type ProjectionSlice } from "./projectionSlice.js";

function indexSlicesByEventTag(slices: readonly ProjectionSlice[]): {
  dependency: EventTagIndex<ProjectionSlice["dependency"]>;
  resource: EventTagIndex<ProjectionSlice["resource"]>;
  communication: EventTagIndex<ProjectionSlice["communication"]>;
  structure: EventTagIndex<ProjectionSlice["structure"]>;
} {
  return {
    dependency: createEventTagIndex(
      slices.map((slice) => ({ tag: slice.eventTag, value: slice.dependency })),
    ),
    resource: createEventTagIndex(
      slices.map((slice) => ({ tag: slice.eventTag, value: slice.resource })),
    ),
    communication: createEventTagIndex(
      slices.map((slice) => ({ tag: slice.eventTag, value: slice.communication })),
    ),
    structure: createEventTagIndex(
      slices.map((slice) => ({ tag: slice.eventTag, value: slice.structure })),
    ),
  };
}

function terminalDependencyLinks(snapshot: ObservationWorld["snapshot"]) {
  return filterLinksByKind(snapshot.links, isDependencyLinkKind);
}

function terminalStructuralLinks(snapshot: ObservationWorld["snapshot"]) {
  return filterLinksByKind(snapshot.links, isStructuralLinkKind);
}

export interface FoldedViews {
  readonly dependency: ReturnType<typeof dependencyView>;
  readonly resource: ReturnType<typeof resourceView>;
  readonly communication: ReturnType<typeof communicationView>;
  readonly structure: ReturnType<typeof structureView>;
}

export function foldFourViews(
  world: ObservationWorld,
  slices: readonly ProjectionSlice[],
  visibility: ObservationVisibilityPolicy = defaultObservationVisibilityPolicy,
): FoldedViews {
  const visibleSlices = slices.filter((slice) => {
    const change = world.changeIndex.get(slice.eventTag.changeId);
    return change !== undefined && visibility.includeInReadAngles(change);
  });
  const indexed = indexSlicesByEventTag(visibleSlices);
  const structureSteps = visibleSlices.map((slice) => slice.structure.step);
  const frozenSnapshot = cloneSnapshotForObservation(world.snapshot);

  return {
    dependency: dependencyView({
      links: terminalDependencyLinks(frozenSnapshot),
      byEvent: indexed.dependency,
    }),
    resource: resourceView({
      capabilities: sortById([...frozenSnapshot.capabilities.values()], "capabilityId"),
      byEvent: indexed.resource,
    }),
    communication: communicationView({
      sessions: sortById([...frozenSnapshot.sessions.values()], "sessionId"),
      byEvent: indexed.communication,
    }),
    structure: structureView({
      composition: foldStructureComposition(structureSteps, frozenSnapshot),
      structuralLinks: terminalStructuralLinks(frozenSnapshot),
      byEvent: indexed.structure,
    }),
  };
}

export function sliceHasProjectionActivity(slice: ProjectionSlice): boolean {
  if (
    slice.dependency.addedLinks.length > 0 ||
    slice.dependency.updatedLinks.length > 0 ||
    slice.dependency.removedLinkIds.length > 0 ||
    slice.resource.updatedCapabilities.length > 0 ||
    slice.resource.removedCapabilityIds.length > 0 ||
    slice.communication.openedSessions.length > 0 ||
    slice.communication.closedSessionIds.length > 0 ||
    slice.communication.updatedSessions.length > 0 ||
    slice.structure.structuralLinks.length > 0 ||
    slice.structure.updatedStructuralLinks.length > 0 ||
    slice.structure.removedStructuralLinkIds.length > 0
  ) {
    return true;
  }
  const step = slice.structure.step;
  if (step.kind !== "box") {
    return true;
  }
  return step.participantId !== undefined || step.artifactId !== undefined;
}

export { eventTagKey } from "../foundation/eventTag.js";
export type { EventTag } from "../foundation/eventTag.js";
