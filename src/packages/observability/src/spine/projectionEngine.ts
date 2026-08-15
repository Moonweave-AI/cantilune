import { buildEventSpine, type EventSpine } from "../world/eventSpine.js";
import { type ObservationWorld } from "../world/observationWorld.js";
import { type SnapshotResolver } from "../input/assembleWorld.js";
import { deriveAllEventSlices } from "./deriveEventSlice.js";
import { foldFourViews } from "./foldFourViews.js";
import { type ProjectionSlice } from "./projectionSlice.js";

export interface ProjectionResult {
  readonly spine: EventSpine;
  readonly slices: readonly ProjectionSlice[];
  readonly views: ReturnType<typeof foldFourViews>;
}

export function projectObservationWorld(
  world: ObservationWorld,
  resolver: SnapshotResolver,
): ProjectionResult {
  const spine = buildEventSpine(world.orderedChanges);
  const slices = deriveAllEventSlices(world, spine.events, resolver);
  const views = foldFourViews(world, slices);
  return { spine, slices, views };
}

export const ProjectionEngine = {
  project: projectObservationWorld,
  deriveAllEventSlices,
  foldFourViews,
};

export type ProjectionEngine = typeof ProjectionEngine;
