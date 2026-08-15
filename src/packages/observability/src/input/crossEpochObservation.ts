import {
  type SchemaAdmissionReceipt,
  type SchemaAdmissionId,
  type ValidatedRunHistory,
  type EpochId,
  validateCrossEpochRunHistory,
  type CrossEpochRunHistory,
  type EpochRunSegment,
} from "@cantilune/core";
import { type ObservationInput } from "./observationInput.js";
import { validateObservationCut } from "./observationCut.js";

export interface CrossEpochObservationInput {
  readonly epochs: readonly EpochRunSegment[];
  readonly admissions: readonly SchemaAdmissionReceipt[];
  readonly windows: readonly ObservationInput[];
}

export function buildCrossEpochObservationInput(
  input: CrossEpochObservationInput,
): CrossEpochRunHistory {
  const history: CrossEpochRunHistory = {
    epochs: input.epochs,
    admissions: input.admissions,
  };
  validateCrossEpochRunHistory(history);
  for (const window of input.windows) {
    validateObservationCut(window);
  }
  return history;
}

export function segmentObservationByEpoch(
  receipts: readonly SchemaAdmissionReceipt[],
): ReadonlyMap<EpochId, SchemaAdmissionId> {
  const map = new Map<EpochId, SchemaAdmissionId>();
  for (const receipt of receipts) {
    map.set(receipt.toBinding.epochId, receipt.admissionId);
  }
  return map;
}

export function mergeValidatedHistories(
  segments: readonly ValidatedRunHistory[],
): ValidatedRunHistory {
  const merged = segments.flatMap((segment) => segment.segments);
  return { kind: "validated", segments: merged };
}
