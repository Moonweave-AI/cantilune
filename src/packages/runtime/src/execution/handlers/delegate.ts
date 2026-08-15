import type { ActorId, CollaborationSnapshot } from "@cantilune/core";
import {
  collaborationLink,
  communicationSession,
  participant,
  withArtifact,
  withCapability,
  withLink,
  withParticipant,
  withSession,
} from "@cantilune/core";
import { withArtifactOwner, withCapabilityHolder } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefFromSnapshot, actorRefsFromSnapshot } from "../participantRef.js";

function findBinding<T extends ReplayRecipe["matchBindings"][number]["role"]>(
  recipe: ReplayRecipe,
  role: T,
): Extract<ReplayRecipe["matchBindings"][number], { role: T }> | undefined {
  const binding = recipe.matchBindings.find((item) => item.role === role);
  return binding as Extract<ReplayRecipe["matchBindings"][number], { role: T }> | undefined;
}

function reviewerParticipantId(
  recipe: ReplayRecipe,
  fromId: ActorId,
  toId: ActorId,
): ActorId | undefined {
  const reviewer = recipe.matchBindings.find(
    (binding) =>
      binding.role === "participant" && binding.actorId !== fromId && binding.actorId !== toId,
  );
  return reviewer?.role === "participant" ? reviewer.actorId : undefined;
}

export function delegateHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const taskBinding = findBinding(recipe, "task");
  const fromBinding = findBinding(recipe, "from");
  const toBinding = findBinding(recipe, "to");
  const capabilityBinding = findBinding(recipe, "capability");

  if (
    taskBinding === undefined ||
    fromBinding === undefined ||
    toBinding === undefined ||
    capabilityBinding === undefined
  ) {
    return { ok: false, reason: "delegate requires task/from/to/capability bindings" };
  }

  const task = before.artifacts.get(taskBinding.artifactId);
  const writeLock = before.capabilities.get(capabilityBinding.capabilityId);
  if (task === undefined || writeLock === undefined) {
    return { ok: false, reason: "missing task or capability before delegate" };
  }

  const toRef = actorRefFromSnapshot(before, toBinding.actorId);
  let after = withArtifact(before, withArtifactOwner(task, toRef));
  after = withCapability(after, withCapabilityHolder(writeLock, toBinding.actorId));

  const sessionId = recipe.createdSessionRefs[0];
  if (sessionId === undefined) {
    return { ok: false, reason: "delegate recipe missing createdSessionRefs[0]" };
  }

  after = withSession(
    after,
    communicationSession(sessionId, toBinding.actorId, [toBinding.actorId, fromBinding.actorId]),
  );

  const reviewerId = reviewerParticipantId(recipe, fromBinding.actorId, toBinding.actorId);
  const linkRef = recipe.freshLinkRefs[0];
  if (reviewerId !== undefined && linkRef !== undefined) {
    if (!after.participants.has(reviewerId)) {
      after = withParticipant(after, participant(reviewerId, "reviewer"));
    }
    after = withLink(
      after,
      collaborationLink(
        linkRef,
        "waits_for",
        { kind: "participant", actorId: reviewerId },
        { kind: "participant", actorId: toBinding.actorId },
      ),
    );
  }

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, [fromBinding.actorId, toBinding.actorId]),
    createdSessionRefs: [sessionId],
  };
}
