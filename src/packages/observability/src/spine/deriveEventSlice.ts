import { resolveSnapshotStrict, type SnapshotResolver } from "../input/assembleWorld.js";
import { readOnlyViolation } from "../foundation/readOnlyViolation.js";
import { type SourceEvent } from "../world/eventSpine.js";
import { type ObservationWorld } from "../world/observationWorld.js";
import { interpretCommunicationDelta } from "../projection/lenses/communicationLens.js";
import { interpretDependencyDelta } from "../projection/lenses/dependencyLens.js";
import { interpretResourceDelta } from "../projection/lenses/resourceLens.js";
import { interpretStructureDelta } from "../projection/lenses/structureLens.js";
import { type ProjectionSlice } from "./projectionSlice.js";

export function deriveEventSlice(
  _world: ObservationWorld,
  event: SourceEvent,
  resolver: SnapshotResolver,
): ProjectionSlice {
  const change = event.change;
  const before = resolveSnapshotStrict(resolver, change.beforeRef, "beforeRef");
  const after = resolveSnapshotStrict(resolver, change.afterRef, "afterRef");

  const eventTag = event.eventTag;
  const dependency = interpretDependencyDelta(eventTag, before, after);
  const resource = interpretResourceDelta(eventTag, before, after);
  const communication = interpretCommunicationDelta(eventTag, before, after);
  const structure = interpretStructureDelta(eventTag, before, after, change);

  return {
    eventTag,
    dependency,
    resource,
    communication,
    structure,
  };
}

export function deriveAllEventSlices(
  world: ObservationWorld,
  events: readonly SourceEvent[],
  resolver: SnapshotResolver,
): ProjectionSlice[] {
  return events.map((event) => deriveEventSlice(world, event, resolver));
}

export function assertSnapshotsAvailable(
  _world: ObservationWorld,
  events: readonly SourceEvent[],
  resolver: SnapshotResolver,
): void {
  for (const event of events) {
    try {
      resolveSnapshotStrict(resolver, event.change.beforeRef, "beforeRef");
      resolveSnapshotStrict(resolver, event.change.afterRef, "afterRef");
    } catch (error) {
      if (isReadOnlyViolation(error) && error.code === "snapshot_unavailable") {
        throw readOnlyViolation(
          "snapshot_unavailable",
          `snapshot chain incomplete for spine projection`,
        );
      }
      throw error;
    }
  }
}

function isReadOnlyViolation(
  value: unknown,
): value is { readonly code: string; readonly message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value as { code: unknown }).code === "snapshot_unavailable"
  );
}

export type { CollaborationSnapshot } from "@cantilune/core";
