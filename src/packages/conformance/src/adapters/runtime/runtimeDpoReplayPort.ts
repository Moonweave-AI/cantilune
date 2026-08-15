import type { Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import { createReplayVerifier, type ReplayVerifierDeps } from "@cantilune/runtime";
import {
  computeReplayRecipeChainDigest,
  formatRecipeChainRef,
  parseRecipeChainRef,
} from "../../canonical/replayRecipeChainDigest.js";
import type {
  DpoReplayExecutionResult,
  DpoReplayFailure,
  DpoReplayPort,
  DpoReplayRequest,
} from "../../ports/dpoReplayPort.js";
import { replayRecipeToSnapshot } from "./replayRecipeSnapshot.js";

export function createRuntimeDpoReplayPort(deps: ReplayVerifierDeps): DpoReplayPort {
  const verifier = createReplayVerifier(deps);
  return {
    async execute(
      request: DpoReplayRequest,
    ): Promise<Result<DpoReplayExecutionResult, DpoReplayFailure>> {
      if (parseRecipeChainRef(request.recipeRef) === undefined) {
        return err({
          code: "recipe_mismatch",
          message: "recipeRef must be recipe-chain:sha256:<digest>",
        });
      }
      const chainDigest = computeReplayRecipeChainDigest({
        changes: request.changes,
        resolveRecipe: (change) => {
          const recipe = deps.durable.recipeForChange(change);
          if (recipe === undefined) {
            throw new Error(`missing recipe for change ${change.changeId}`);
          }
          return replayRecipeToSnapshot(change, recipe);
        },
      });
      const expectedRef = formatRecipeChainRef(chainDigest);
      if (request.recipeRef !== expectedRef) {
        return err({
          code: "recipe_mismatch",
          message: `recipeRef ${request.recipeRef} !== durable chain ${expectedRef}`,
        });
      }
      const result = verifier.verify({
        fromRef: request.fromSnapshotRef,
        toRef: request.toSnapshotRef,
        changes: request.changes,
      });
      if (!result.ok) {
        return err({
          code: result.violation.code,
          message: result.violation.message,
        });
      }
      if (result.terminalRef !== request.toSnapshotRef) {
        return err({
          code: "replay_mismatch",
          message: `terminal ${result.terminalRef} !== expected ${request.toSnapshotRef}`,
        });
      }
      return ok({
        terminalSnapshotRef: result.terminalRef,
        stepCount: result.steps.length,
      });
    },
  };
}
