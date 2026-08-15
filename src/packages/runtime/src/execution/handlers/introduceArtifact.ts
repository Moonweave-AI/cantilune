import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  CollaborationSnapshot,
  MatchBinding,
} from "@cantilune/core";
import { withArtifact, withCapability } from "@cantilune/core";
import { scopedCapability, workArtifact } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefFromSnapshot, actorRefsFromSnapshot } from "../participantRef.js";

function bindingArtifactId(
  bindings: readonly MatchBinding[],
  role: "task" | "artifact",
): ArtifactId | undefined {
  const binding = bindings.find((item) => item.role === role);
  if (binding?.role === "task" || binding?.role === "artifact") {
    return binding.artifactId;
  }
  return undefined;
}

function bindingActorId(
  bindings: readonly MatchBinding[],
  role: "from" | "to" | "delegator" | "delegatee" | "participant",
): ActorId | undefined {
  const binding = bindings.find((item) => item.role === role);
  if (
    binding?.role === "from" ||
    binding?.role === "to" ||
    binding?.role === "delegator" ||
    binding?.role === "delegatee" ||
    binding?.role === "participant"
  ) {
    return binding.actorId;
  }
  return undefined;
}

function bindingCapabilityId(bindings: readonly MatchBinding[]): CapabilityId | undefined {
  const binding = bindings.find((item) => item.role === "capability");
  if (binding?.role === "capability") {
    return binding.capabilityId;
  }
  return undefined;
}

function defaultWriteLockId(taskId: ArtifactId): CapabilityId {
  return `write-lock-${taskId}` as CapabilityId;
}

export function introduceArtifactHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const taskId = bindingArtifactId(recipe.matchBindings, "task");
  const fromId = bindingActorId(recipe.matchBindings, "from");
  if (taskId === undefined || fromId === undefined) {
    return { ok: false, reason: "introduce_artifact requires task and from bindings" };
  }
  if (before.artifacts.has(taskId)) {
    return { ok: false, reason: `artifact already exists: ${taskId}` };
  }

  const content = recipe.inputContentRefs[0];
  if (content === undefined) {
    return { ok: false, reason: "introduce_artifact requires an input contentRef" };
  }

  const owner = actorRefFromSnapshot(before, fromId);
  const capabilityId = bindingCapabilityId(recipe.matchBindings) ?? defaultWriteLockId(taskId);

  const task = workArtifact(taskId, "Task", content, owner, "active");
  const writeLock = scopedCapability(capabilityId, "write_lock", fromId, {
    kind: "artifact",
    artifactId: taskId,
  });

  const after = withCapability(withArtifact(before, task), writeLock);
  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, [fromId]),
    createdSessionRefs: [],
  };
}
