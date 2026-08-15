import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { RuntimeReplayOracle, ReplayResult } from "../../ports/productEvidence.js";

/**
 * Adapter for runtime replay verification.
 * Evaluation only reads from runtime's public replay/trace API —
 * it never modifies runtime world or control-plane policy.
 */
export function createCantiluneReplayAdapter(replayPort: ReplayPort): RuntimeReplayOracle {
  return {
    async replay(
      snapshotRef: string,
      events: readonly unknown[],
    ): Promise<EvaluationResult<ReplayResult>> {
      try {
        const result = await replayPort.replayFromSnapshot(snapshotRef, events);
        return ok(result);
      } catch (e) {
        return violations([
          violation(
            "evidence_incomplete",
            "replay",
            `Replay failed: ${e instanceof Error ? e.message : "unknown error"}`,
          ),
        ]);
      }
    },
  };
}

export interface ReplayPort {
  replayFromSnapshot(snapshotRef: string, events: readonly unknown[]): Promise<ReplayResult>;
}
