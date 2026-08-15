import type { CoordinationChange } from "@cantilune/core";
import type { ReplayRecipe } from "@cantilune/runtime";
import {
  replayRecipeSnapshotFromChange,
  type ReplayRecipeSnapshot,
} from "../../canonical/replayRecipeChainDigest.js";

export function replayRecipeToSnapshot(
  change: CoordinationChange,
  recipe: ReplayRecipe,
): ReplayRecipeSnapshot {
  return replayRecipeSnapshotFromChange(change, {
    epochId: recipe.epochId,
    operationTypeId: recipe.operationTypeId,
    ...(recipe.templateRef !== undefined ? { templateRef: recipe.templateRef } : {}),
    matchBindings: recipe.matchBindings,
    matchWitness: recipe.matchWitness,
    complementTag: recipe.complementTag,
    kind: recipe.kind,
    authorization: recipe.authorization.map(String),
    external: recipe.external.map(String),
    createdSessionRefs: recipe.createdSessionRefs.map(String),
    freshLinkRefs: recipe.freshLinkRefs.map(String),
    inputContentRefs: recipe.inputContentRefs.map(String),
    visibility: recipe.visibility,
  });
}

export function resolveRecipeSnapshot(
  change: CoordinationChange,
  recipeForChange: (change: CoordinationChange) => ReplayRecipe | undefined,
): ReplayRecipeSnapshot | undefined {
  const recipe = recipeForChange(change);
  if (recipe === undefined) {
    return undefined;
  }
  return replayRecipeToSnapshot(change, recipe);
}
