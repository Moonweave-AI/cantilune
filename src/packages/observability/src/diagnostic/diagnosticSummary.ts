import {
  deriveDiagnosticSummary,
  deriveSnapshotStatsWithHistory,
  type DerivedDiagnosticView,
} from "@cantilune/core";
import { type ObservationWorld } from "../world/observationWorld.js";
import { type StructureView } from "../projection/views/structureView.js";

export interface DiagnosticSummary {
  readonly stats: ReturnType<typeof deriveSnapshotStatsWithHistory>;
  readonly compositionHint: DerivedDiagnosticView;
}

export function compressDiagnostic(
  world: ObservationWorld,
  structureView: StructureView,
): DiagnosticSummary {
  return {
    stats: deriveSnapshotStatsWithHistory(world.snapshot, world.validatedHistory.segments),
    compositionHint: structureView.composition,
  };
}

export function compressDiagnosticFromHistory(world: ObservationWorld): DiagnosticSummary {
  return {
    stats: deriveSnapshotStatsWithHistory(world.snapshot, world.validatedHistory.segments),
    compositionHint: deriveDiagnosticSummary(world.snapshot, world.validatedHistory.segments),
  };
}
