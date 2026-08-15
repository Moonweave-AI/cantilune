import type { LinkId, OperationTypeId } from "@cantilune/core";
import type { IdGenerator } from "../ports/idGenerator.js";
import type { ReplayRecipe } from "../replay/recipe.js";

function countDelegateReviewerLinks(recipe: ReplayRecipe): number {
  const fromId = recipe.matchBindings.find((b) => b.role === "from");
  const fromActorId = fromId?.role === "from" ? fromId.actorId : undefined;
  const reviewers = recipe.matchBindings.filter(
    (binding) =>
      binding.role === "participant" &&
      binding.actorId !== fromActorId &&
      !recipe.matchBindings.some(
        (other) => other.role === "to" && other.actorId === binding.actorId,
      ),
  );
  return reviewers.length > 0 ? 1 : 0;
}

function countCreateSessionLinks(recipe: ReplayRecipe): number {
  const controller = recipe.matchBindings.find((binding) => binding.role === "from");
  const controllerId = controller?.role === "from" ? controller.actorId : undefined;
  return recipe.matchBindings.filter(
    (binding) => binding.role === "participant" && binding.actorId !== controllerId,
  ).length;
}

function countForkLinks(recipe: ReplayRecipe): number {
  const fromBinding = recipe.matchBindings.find((binding) => binding.role === "from");
  const controllerId = fromBinding?.role === "from" ? fromBinding.actorId : undefined;
  if (controllerId === undefined) {
    return 0;
  }
  const peers = recipe.matchBindings
    .filter((binding) => binding.role === "participant")
    .map((binding) => binding.actorId);
  const unique = [...new Set([controllerId, ...peers])];
  if (unique.length < 2) {
    return 0;
  }
  return (unique.length * (unique.length - 1)) / 2;
}

/** Pre-allocate deterministic fresh entity refs before apply — replay reuses recipe refs only. */
export function allocateFreshRefsForRecipe(
  recipe: ReplayRecipe,
  operationTypeId: OperationTypeId,
  idGen: IdGenerator,
): ReplayRecipe {
  let linkCount = 0;
  switch (operationTypeId) {
    case "delegate":
      linkCount = countDelegateReviewerLinks(recipe);
      break;
    case "create_session":
      linkCount = countCreateSessionLinks(recipe);
      break;
    case "fork_branch":
      linkCount = countForkLinks(recipe);
      break;
  }

  const freshLinkRefs: LinkId[] = [];
  for (let i = 0; i < linkCount; i++) {
    freshLinkRefs.push(idGen.linkId());
  }

  const sessionCount = recipe.createdSessionRefs.length;
  let createdSessionRefs: ReplayRecipe["createdSessionRefs"];
  if (sessionCount > 0) {
    createdSessionRefs = [...recipe.createdSessionRefs];
  } else if (operationTypeId === "delegate" || operationTypeId === "create_session") {
    createdSessionRefs = [idGen.sessionId()];
  } else {
    createdSessionRefs = [];
  }

  return {
    ...recipe,
    freshLinkRefs,
    createdSessionRefs,
  };
}
