import type { CollaborationSnapshot } from "@cantilune/core";
import type { ReplayRecipe } from "../replay/recipe.js";
import type { ApplyContext } from "./applyContext.js";
import type { ApplyResult, OperationHandlerRegistry } from "./handlerRegistry.js";
import { applyRecipe } from "./applyChange.js";

/**
 * Lean ReplayKernel.run — deterministic recipe + source → optional target.
 */
export function replayKernelRun(
  recipe: ReplayRecipe,
  source: CollaborationSnapshot,
  registry: OperationHandlerRegistry,
  ctx: ApplyContext,
): ApplyResult {
  return applyRecipe(source, recipe, registry, ctx);
}
