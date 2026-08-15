import { type CollaborationSnapshot, type SnapshotRef } from "@cantilune/core";
import { buildReadModelDerivationEvidence } from "../certificate/readModelDerivationEvidence.js";
import {
  type AssembleWorldOptions,
  assembleObservationWorld,
  createSnapshotResolver,
} from "../input/assembleWorld.js";
import { type ObservationInput, type ObservationReadPorts } from "../input/observationInput.js";
import { readObservationCutFromPorts } from "../input/observationCut.js";
import { compressDiagnostic } from "../diagnostic/diagnosticSummary.js";
import { validateCrossViewInvariants } from "../invariants/crossViewInvariants.js";
import { freezeFourViewBundle } from "../foundation/immutableBoundary.js";
import { projectObservationWorld } from "../spine/projectionEngine.js";
import { type ObservationWorld } from "../world/observationWorld.js";
import { readOnlyViolation } from "../foundation/readOnlyViolation.js";
import { fourViewBundle, type FourViewBundle } from "./fourViewBundle.js";

export interface ObservationIndexOptions {
  readonly snapshotReader?: {
    get(ref: SnapshotRef): CollaborationSnapshot | undefined;
  };
  readonly attachDiagnostic?: boolean;
  /** Attach engineering read-model evidence (default false). */
  readonly attachEvidence?: boolean;
  readonly validateInvariants?: boolean;
}

export interface ObservationIndex {
  fromWorld(world: ObservationWorld, options?: ObservationIndexOptions): FourViewBundle;
  fromInput(input: ObservationInput, options?: ObservationIndexOptions): FourViewBundle;
  observeCommitted(
    ports: ObservationReadPorts,
    sinceRef: SnapshotRef,
    options?: ObservationIndexOptions,
  ): FourViewBundle;
}

function resolveSnapshotReader(
  ports: ObservationReadPorts | undefined,
  options?: ObservationIndexOptions,
): { get(ref: SnapshotRef): CollaborationSnapshot | undefined } | undefined {
  if (options?.snapshotReader !== undefined) {
    return options.snapshotReader;
  }
  if (ports !== undefined) {
    return { get: (ref) => ports.getSnapshot(ref) };
  }
  return undefined;
}

function assembleOptions(
  ports: ObservationReadPorts | undefined,
  options?: ObservationIndexOptions,
): AssembleWorldOptions {
  const snapshotReader = resolveSnapshotReader(ports, options);
  if (snapshotReader === undefined) {
    return {};
  }
  return { snapshotReader };
}

function projectWorld(
  world: ObservationWorld,
  options: ObservationIndexOptions = {},
  ports?: ObservationReadPorts,
): FourViewBundle {
  const snapshotReader = resolveSnapshotReader(ports, options);
  const resolver = createSnapshotResolver(world.snapshot, snapshotReader);
  const projected = projectObservationWorld(world, resolver);
  const baseBundle = fourViewBundle({
    spine: projected.spine,
    dependency: projected.views.dependency,
    resource: projected.views.resource,
    communication: projected.views.communication,
    structure: projected.views.structure,
    ...(options.attachDiagnostic !== false
      ? { diagnostic: compressDiagnostic(world, projected.views.structure) }
      : {}),
  });
  const bundle =
    options.attachEvidence === true
      ? fourViewBundle({
          ...baseBundle,
          evidence: buildReadModelDerivationEvidence(baseBundle, world, resolver),
        })
      : baseBundle;

  if (options.validateInvariants !== false) {
    const validation = validateCrossViewInvariants(bundle, world);
    if (!validation.ok) {
      throw readOnlyViolation(
        "cross_view_mismatch",
        validation.violations.map((v) => v.message).join("; "),
      );
    }
  }

  return freezeFourViewBundle(bundle);
}

export function createObservationIndex(): ObservationIndex {
  return {
    fromWorld(world, options) {
      return projectWorld(world, options);
    },
    fromInput(input, options) {
      const world = assembleObservationWorld(input, assembleOptions(undefined, options));
      return projectWorld(world, options);
    },
    observeCommitted(ports, sinceRef, options) {
      const input = readObservationCutFromPorts(ports, sinceRef);
      const world = assembleObservationWorld(input, assembleOptions(ports, options));
      return projectWorld(world, options, ports);
    },
  };
}

export type { FourViewBundle };
