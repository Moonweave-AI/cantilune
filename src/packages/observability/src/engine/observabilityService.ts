import { type SnapshotRef } from "@cantilune/core";
import { createObservationIndex, type ObservationIndexOptions } from "../index/observationIndex.js";
import { type ObservationReadPorts } from "../input/observationInput.js";
import { type FourViewBundle } from "../index/fourViewBundle.js";
import { ProjectionEngine } from "../spine/projectionEngine.js";
import {
  requireAccessContext,
  type ObservationAccessContext,
} from "../input/observationAccessContext.js";

export interface ObservabilityService {
  readonly index: ReturnType<typeof createObservationIndex>;
  readonly engine: typeof ProjectionEngine;
  observeCommitted(
    ports: ObservationReadPorts,
    sinceRef: SnapshotRef,
    options?: ObservationIndexOptions,
    accessContext?: ObservationAccessContext,
  ): FourViewBundle;
}

export function createObservabilityService(options?: {
  /** When true, observeCommitted requires ObservationAccessContext (production SDK). */
  readonly requireAccessContext?: boolean;
}): ObservabilityService {
  const index = createObservationIndex();
  const enforceAccess = options?.requireAccessContext === true;
  return {
    index,
    engine: ProjectionEngine,
    observeCommitted(ports, sinceRef, indexOptions, accessContext) {
      if (enforceAccess) {
        requireAccessContext(accessContext);
      }
      return index.observeCommitted(ports, sinceRef, indexOptions);
    },
  };
}
