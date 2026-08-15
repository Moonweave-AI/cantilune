import type { ChangeId, CoordinationChange } from "@cantilune/core";
import type { ReplayRecipe } from "./recipe.js";
import { replayRecipeFromChange } from "./recipe.js";
import { snapshotReplayRecipe } from "./authoritySnapshot.js";

/** Persists full ReplayRecipe metadata keyed by changeId (witness + complementTag). */
export class RecipeSidecar {
  private readonly recipes = new Map<ChangeId, ReplayRecipe>();

  put(changeId: ChangeId, recipe: ReplayRecipe): void {
    this.recipes.set(changeId, snapshotReplayRecipe(recipe));
  }

  get(changeId: ChangeId): ReplayRecipe | undefined {
    const stored = this.recipes.get(changeId);
    return stored === undefined ? undefined : snapshotReplayRecipe(stored);
  }

  recipeForChange(change: CoordinationChange): ReplayRecipe {
    const stored = this.recipes.get(change.changeId);
    return snapshotReplayRecipe(stored ?? replayRecipeFromChange(change));
  }
}
