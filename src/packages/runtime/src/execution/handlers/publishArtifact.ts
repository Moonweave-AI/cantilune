import type { ArtifactId, CollaborationSnapshot } from "@cantilune/core";
import { withArtifact, withArtifactLifecycle } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";

function taskIdFromRecipe(recipe: ReplayRecipe): string | undefined {
  const task = recipe.matchBindings.find((binding) => binding.role === "task");
  if (task?.role === "task") {
    return task.artifactId;
  }
  const artifact = recipe.matchBindings.find((binding) => binding.role === "artifact");
  if (artifact?.role === "artifact") {
    return artifact.artifactId;
  }
  return undefined;
}

export function publishArtifactHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const artifactId = taskIdFromRecipe(recipe);
  if (artifactId === undefined) {
    return { ok: false, reason: "publish_artifact requires task binding" };
  }

  const artifact = before.artifacts.get(artifactId as ArtifactId);
  if (artifact === undefined) {
    return { ok: false, reason: `artifact not found: ${artifactId}` };
  }

  const fromBinding = recipe.matchBindings.find((binding) => binding.role === "from");
  const after = withArtifact(before, withArtifactLifecycle(artifact, "published"));

  return {
    ok: true,
    after,
    involved:
      fromBinding?.role === "from" ? actorRefsFromSnapshot(before, [fromBinding.actorId]) : [],
    createdSessionRefs: [],
  };
}
