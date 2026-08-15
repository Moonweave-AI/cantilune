import type { EpochId } from "../primitives/ids.js";
import type { SchemaAdmissionReceipt } from "../coordination/schemaAdmissionReceipt.js";
import type { ValidatedRunHistory } from "./trace.js";

/** One execution epoch segment with validated intra-epoch trace. */
export interface EpochRunSegment {
  readonly epochId: EpochId;
  readonly history: ValidatedRunHistory;
}

/**
 * Cross-epoch history: per-epoch validated traces plus admission boundaries.
 * admissions[i] connects epochs[i] → epochs[i + 1].
 */
export interface CrossEpochRunHistory {
  readonly epochs: readonly EpochRunSegment[];
  readonly admissions: readonly SchemaAdmissionReceipt[];
}

export function validateCrossEpochRunHistory(history: CrossEpochRunHistory): void {
  if (history.admissions.length !== Math.max(0, history.epochs.length - 1)) {
    throw new Error(
      `cross_epoch_history_invalid: admissions=${history.admissions.length} epochs=${history.epochs.length}`,
    );
  }
  for (let index = 0; index < history.admissions.length; index += 1) {
    const admission = history.admissions[index]!;
    const fromEpoch = history.epochs[index]!;
    const toEpoch = history.epochs[index + 1]!;
    if (admission.fromBinding.epochId !== fromEpoch.epochId) {
      throw new Error("cross_epoch_history_invalid: admission from epoch mismatch");
    }
    if (admission.toBinding.epochId !== toEpoch.epochId) {
      throw new Error("cross_epoch_history_invalid: admission to epoch mismatch");
    }
    if (admission.beforeSnapshotRef !== admission.fromBinding.runtimeHead) {
      throw new Error("cross_epoch_history_invalid: beforeRef mismatch");
    }
  }
}
