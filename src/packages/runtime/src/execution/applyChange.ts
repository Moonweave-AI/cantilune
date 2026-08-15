import type { CollaborationSnapshot } from "@cantilune/core";
import type { AdmittedRecord } from "../admission/admittedRecord.js";
import type { ReplayRecipe } from "../replay/recipe.js";
import type { ApplyContext } from "./applyContext.js";
import type { ApplyResult, OperationHandlerRegistry } from "./handlerRegistry.js";

export function applyAdmittedChange(
  admitted: AdmittedRecord,
  registry: OperationHandlerRegistry,
): ApplyResult {
  const ctx: ApplyContext = { template: admitted.template };
  return applyRecipe(admitted.beforeSnapshot, admitted.recipe, registry, ctx);
}

export function applyRecipe(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  registry: OperationHandlerRegistry,
  ctx: ApplyContext,
): ApplyResult {
  const revision = recipe.templateRef?.revision;
  const handler = registry.get(recipe.operationTypeId, revision);
  if (handler === undefined) {
    return {
      ok: false,
      reason: `no handler for ${recipe.operationTypeId}@${revision ?? "default"}`,
    };
  }

  return handler(before, recipe, ctx);
}
