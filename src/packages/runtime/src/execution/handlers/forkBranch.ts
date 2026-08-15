import type { ActorId, ArtifactId, CapabilityId, CollaborationSnapshot } from "@cantilune/core";
import {
  collaborationLink,
  scopedCapability,
  withArtifact,
  withCapability,
  withLink,
  workArtifact,
} from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefFromSnapshot, actorRefsFromSnapshot } from "../participantRef.js";

function findRole<T extends ReplayRecipe["matchBindings"][number]["role"]>(
  recipe: ReplayRecipe,
  role: T,
): Extract<ReplayRecipe["matchBindings"][number], { role: T }> | undefined {
  return recipe.matchBindings.find((item) => item.role === role) as
    Extract<ReplayRecipe["matchBindings"][number], { role: T }> | undefined;
}

function defaultWriteLockId(taskId: ArtifactId): CapabilityId {
  return `write-lock-${taskId}` as CapabilityId;
}

function branchParticipants(recipe: ReplayRecipe, controllerId: ActorId): ActorId[] {
  const peers = recipe.matchBindings
    .filter((binding) => binding.role === "participant")
    .map((binding) => binding.actorId as ActorId);
  return [...new Set<ActorId>([controllerId, ...peers])];
}

type StepResult =
  | { readonly ok: true; readonly after: CollaborationSnapshot }
  | { readonly ok: false; readonly reason: string };

/** Creates the branch's task artifact and its write lock, when the recipe binds one. */
function applyTaskArtifact(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  controllerId: ActorId,
): StepResult {
  const taskBinding = findRole(recipe, "task");
  if (taskBinding === undefined) {
    if (recipe.inputContentRefs.length > 0) {
      return {
        ok: false,
        reason: "fork_branch input contentRef requires a task binding",
      };
    }
    return { ok: true, after: before };
  }

  const taskId = taskBinding.artifactId;
  if (before.artifacts.has(taskId)) {
    return { ok: false, reason: `artifact already exists: ${taskId}` };
  }

  const content = recipe.inputContentRefs[0];
  if (content === undefined) {
    return {
      ok: false,
      reason: "fork_branch with a task binding requires an input contentRef",
    };
  }

  const owner = actorRefFromSnapshot(before, controllerId);
  const capabilityId = findRole(recipe, "capability")?.capabilityId ?? defaultWriteLockId(taskId);
  const task = workArtifact(taskId, "Task", content, owner, "active");
  const writeLock = scopedCapability(capabilityId, "write_lock", controllerId, {
    kind: "artifact",
    artifactId: taskId,
  });

  return { ok: true, after: withCapability(withArtifact(before, task), writeLock) };
}

/** Joins every pair of branch participants with a `parallel_with` link. */
function linkPeersPairwise(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  participants: readonly ActorId[],
): StepResult {
  let after = before;
  let linkIndex = 0;

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const left = participants[i];
      const right = participants[j];
      if (left === undefined || right === undefined) continue;

      const linkRef = recipe.freshLinkRefs[linkIndex];
      linkIndex += 1;
      if (linkRef === undefined) {
        return { ok: false, reason: "fork_branch recipe missing freshLinkRefs" };
      }

      after = withLink(
        after,
        collaborationLink(
          linkRef,
          "parallel_with",
          { kind: "participant", actorId: left },
          { kind: "participant", actorId: right },
        ),
      );
    }
  }

  return { ok: true, after };
}

export function forkBranchHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = findRole(recipe, "from");
  if (fromBinding === undefined) {
    return { ok: false, reason: "fork_branch requires from binding" };
  }

  const controllerId = fromBinding.actorId;

  const withTask = applyTaskArtifact(before, recipe, controllerId);
  if (!withTask.ok) {
    return { ok: false, reason: withTask.reason };
  }

  const participants = branchParticipants(recipe, controllerId);
  const linked = linkPeersPairwise(withTask.after, recipe, participants);
  if (!linked.ok) {
    return { ok: false, reason: linked.reason };
  }

  return {
    ok: true,
    after: linked.after,
    involved: actorRefsFromSnapshot(before, [controllerId]),
    createdSessionRefs: [],
  };
}
