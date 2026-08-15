import type { ActorId, CollaborationSnapshot, SessionId } from "@cantilune/core";
import { collaborationLink, communicationSession, withLink, withSession } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";

function findRole<T extends ReplayRecipe["matchBindings"][number]["role"]>(
  recipe: ReplayRecipe,
  role: T,
): Extract<ReplayRecipe["matchBindings"][number], { role: T }> | undefined {
  return recipe.matchBindings.find((item) => item.role === role) as
    Extract<ReplayRecipe["matchBindings"][number], { role: T }> | undefined;
}

function sessionParticipants(recipe: ReplayRecipe, controllerId: ActorId): ActorId[] {
  const peers = recipe.matchBindings
    .filter((binding) => binding.role === "participant")
    .map((binding) => binding.actorId as ActorId);
  return [...new Set<ActorId>([controllerId, ...peers])];
}

export function createSessionHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = findRole(recipe, "from");
  if (fromBinding === undefined) {
    return { ok: false, reason: "create_session requires from binding" };
  }

  const controllerId = fromBinding.actorId;
  const sessionId: SessionId | undefined =
    recipe.createdSessionRefs[0] ?? findRole(recipe, "session")?.sessionId;
  if (sessionId === undefined) {
    return { ok: false, reason: "create_session recipe missing session ref" };
  }

  if (before.sessions.has(sessionId)) {
    return { ok: false, reason: `session already exists: ${sessionId}` };
  }

  const participants = sessionParticipants(recipe, controllerId);

  let after = withSession(before, communicationSession(sessionId, controllerId, participants));

  let linkIndex = 0;
  for (const memberId of participants) {
    if (memberId === controllerId) {
      continue;
    }
    const linkRef = recipe.freshLinkRefs[linkIndex];
    linkIndex += 1;
    if (linkRef === undefined) {
      return { ok: false, reason: "create_session recipe missing freshLinkRefs" };
    }
    after = withLink(
      after,
      collaborationLink(
        linkRef,
        "nested_in",
        { kind: "participant", actorId: controllerId },
        { kind: "participant", actorId: memberId },
      ),
    );
  }

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, participants),
    createdSessionRefs: [sessionId],
  };
}
