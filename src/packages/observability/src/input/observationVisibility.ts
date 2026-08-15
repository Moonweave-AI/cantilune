import { type CoordinationChange } from "@cantilune/core";

/** Which committed changes participate in engineering read-angle deltas. */
export interface ObservationVisibilityPolicy {
  readonly includeInReadAngles: (change: CoordinationChange) => boolean;
}

/** Hide administrative-only rewrites from read angles; raw spine retains all events. */
export const defaultObservationVisibilityPolicy: ObservationVisibilityPolicy = {
  includeInReadAngles(change) {
    return change.visibility !== "administrative";
  },
};
