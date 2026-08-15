import type { CollaborationSnapshot, SnapshotRef } from "@cantilune/core";
import type { RunHistoryTracker, CoordinationRuntime } from "@cantilune/runtime";
import { assembleObservationWorld } from "../../../src/input/assembleWorld.js";
import { readObservationCutFromPorts } from "../../../src/input/observationCut.js";
import { createObservationReadPorts } from "../../../src/input/observationInput.js";
import {
  createObservationIndex,
  type ObservationIndexOptions,
} from "../../../src/index/observationIndex.js";
import { type FourViewBundle } from "../../../src/index/fourViewBundle.js";
import {
  validateCrossViewInvariants,
  type CrossViewValidation,
} from "../../../src/invariants/crossViewInvariants.js";
import { type ObservationWorld } from "../../../src/world/observationWorld.js";
import { type ChangeLogLike, type StoreLike } from "../buildTestRuntime.js";
import { replayChainStart } from "./scenarioRunner.js";

export interface ObservabilityClosure {
  readonly bundle: FourViewBundle;
  readonly world: ObservationWorld;
  readonly validation: CrossViewValidation;
  readonly sinceRef: SnapshotRef;
  readonly commitCount: number;
}

export interface RuntimeObservationPorts {
  readonly runtime: CoordinationRuntime;
  readonly store: StoreLike;
  readonly changelog: ChangeLogLike;
  readonly runHistory: RunHistoryTracker;
  readonly t0: CollaborationSnapshot;
}

export function createRuntimeObservationPorts(deps: RuntimeObservationPorts) {
  return createObservationReadPorts({
    head: () => deps.runtime.getHead()?.snapshotRef,
    getSnapshot: (ref) => deps.store.get(ref),
    changesSince: (ref) => deps.changelog.since(ref),
    runHistory: () => deps.runHistory.current(),
  });
}

export function observeCommittedViaIndex(
  deps: RuntimeObservationPorts,
  sinceRef?: SnapshotRef,
  options?: ObservationIndexOptions,
): FourViewBundle {
  const resolvedSince = sinceRef ?? replayChainStart(deps.changelog, deps.t0);
  const index = createObservationIndex();
  return index.observeCommitted(createRuntimeObservationPorts(deps), resolvedSince, options);
}

export function observeCommittedExplicit(
  deps: RuntimeObservationPorts,
  sinceRef?: SnapshotRef,
  options?: ObservationIndexOptions,
): ObservabilityClosure {
  const resolvedSince = sinceRef ?? replayChainStart(deps.changelog, deps.t0);
  const ports = createRuntimeObservationPorts(deps);
  const bundle = observeCommittedViaIndex(deps, resolvedSince, options);
  const input = readObservationCutFromPorts(ports, resolvedSince);
  const world = assembleObservationWorld(input, { snapshotReader: deps.store });
  const validation = validateCrossViewInvariants(bundle, world);
  if (options?.validateInvariants !== false && !validation.ok) {
    throw validation.violations[0];
  }
  return {
    bundle,
    world,
    validation,
    sinceRef: resolvedSince,
    commitCount: world.orderedChanges.length,
  };
}
