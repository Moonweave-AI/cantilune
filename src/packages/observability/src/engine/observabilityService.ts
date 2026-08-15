import { type SnapshotRef } from "@cantilune/core";
import { createObservationIndex, type ObservationIndexOptions } from "../index/observationIndex.js";
import { type ObservationReadPorts } from "../input/observationInput.js";
import { type FourViewBundle } from "../index/fourViewBundle.js";
import { ProjectionEngine } from "../spine/projectionEngine.js";

export interface ObservabilityService {
  readonly index: ReturnType<typeof createObservationIndex>;
  readonly engine: typeof ProjectionEngine;
  observeCommitted(
    ports: ObservationReadPorts,
    sinceRef: SnapshotRef,
    options?: ObservationIndexOptions,
  ): FourViewBundle;
}

export function createObservabilityService(): ObservabilityService {
  const index = createObservationIndex();
  return {
    index,
    engine: ProjectionEngine,
    observeCommitted(ports, sinceRef, options) {
      return index.observeCommitted(ports, sinceRef, options);
    },
  };
}
