import { epochId, epochOrdinal, type EpochId, type EpochOrdinal } from "@cantilune/core";

/** Advance epoch identity without Number() on opaque branded ids. */
export function nextEpochFrom(
  currentId: EpochId,
  currentOrdinal: EpochOrdinal,
): {
  readonly epochId: EpochId;
  readonly epochOrdinal: EpochOrdinal;
} {
  const nextOrdinal = (currentOrdinal as number) + 1;
  return {
    epochId: epochId(`${String(currentId)}->${String(nextOrdinal)}`),
    epochOrdinal: epochOrdinal(nextOrdinal),
  };
}
