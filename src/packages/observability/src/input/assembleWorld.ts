import { type CollaborationSnapshot, type SnapshotRef } from "@cantilune/core";
import { cloneSnapshotForObservation } from "../foundation/immutableBoundary.js";
import { readOnlyViolation } from "../foundation/readOnlyViolation.js";
import { observationWorld, type ObservationWorld } from "../world/observationWorld.js";
import { validateObservationCut } from "./observationCut.js";
import { type ObservationInput, type SnapshotReader } from "./observationInput.js";

export interface AssembleWorldOptions {
  readonly snapshotReader?: SnapshotReader;
  readonly validateChain?: boolean;
}

function requiresHistoricalSnapshots(input: ObservationInput): boolean {
  if (input.changes.length === 0) {
    return false;
  }
  const headRef = input.headRef;
  return input.changes.some(
    (change) => change.beforeRef !== headRef || change.afterRef !== headRef,
  );
}

export function assembleObservationWorld(
  input: ObservationInput,
  options: AssembleWorldOptions = {},
): ObservationWorld {
  if (options.validateChain !== false) {
    validateObservationCut(input);
  }

  if (requiresHistoricalSnapshots(input) && options.snapshotReader === undefined) {
    throw readOnlyViolation(
      "invalid_input",
      "snapshotReader required when observation window references historical snapshots",
      "snapshotReader",
    );
  }

  return observationWorld({
    snapshotRef: input.headRef,
    snapshot: cloneSnapshotForObservation(input.snapshot),
    validatedHistory: input.validatedHistory,
    changes: input.changes,
    sinceRef: input.sinceRef,
  });
}

export interface SnapshotResolver {
  resolve(ref: SnapshotRef): CollaborationSnapshot | undefined;
}

export function createSnapshotResolver(
  head: CollaborationSnapshot,
  snapshotReader?: SnapshotReader,
): SnapshotResolver {
  const frozenHead = cloneSnapshotForObservation(head);
  return {
    resolve(ref: SnapshotRef): CollaborationSnapshot | undefined {
      if (frozenHead.snapshotRef === ref) {
        return frozenHead;
      }
      const historical = snapshotReader?.get(ref);
      return historical === undefined ? undefined : cloneSnapshotForObservation(historical);
    },
  };
}

export function resolveSnapshotStrict(
  resolver: SnapshotResolver,
  ref: SnapshotRef,
  path: string,
): CollaborationSnapshot {
  const snapshot = resolver.resolve(ref);
  if (snapshot === undefined) {
    throw readOnlyViolation("snapshot_unavailable", `snapshot ${String(ref)} unavailable`, path);
  }
  if (snapshot.snapshotRef !== ref) {
    throw readOnlyViolation(
      "snapshot_unavailable",
      `snapshot resolver returned ${String(snapshot.snapshotRef)} for requested ${String(ref)}`,
      path,
    );
  }
  return snapshot;
}

export type { ValidatedRunHistory } from "@cantilune/core";
