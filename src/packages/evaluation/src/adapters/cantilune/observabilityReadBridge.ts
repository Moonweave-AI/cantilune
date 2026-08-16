/**
 * Read-only observability bridge (ADR-0011 E3).
 * Callers inject the public `observeCommitted` export — evaluation never writes.
 */
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { ObservationReader } from "../../ports/productEvidence.js";

export interface ObservabilityObserveFn {
  (
    ports: unknown,
    sinceRef: string,
    options?: unknown,
    accessContext?: unknown,
  ): unknown;
}

export function createObservabilityReadBridge(input: {
  readonly observeCommitted: ObservabilityObserveFn;
  readonly ports: unknown;
  readonly accessContext?: unknown;
}): ObservationReader {
  return {
    async readObservations(
      _runRef: string,
      fromEpoch: string,
      _toEpoch: string,
    ): Promise<EvaluationResult<readonly unknown[]>> {
      try {
        const bundle = input.observeCommitted(
          input.ports,
          fromEpoch,
          undefined,
          input.accessContext,
        );
        if (bundle === undefined || bundle === null) {
          return violations([
            violation("evidence_incomplete", "observe", "observeCommitted returned no bundle"),
          ]);
        }
        return ok([bundle]);
      } catch (err) {
        return violations([
          violation(
            "evidence_incomplete",
            "observe",
            `Observability read failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        ]);
      }
    },
  };
}
