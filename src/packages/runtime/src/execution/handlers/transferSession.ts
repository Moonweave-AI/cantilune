import type { CollaborationSnapshot } from "@cantilune/core";
import { communicationSession, withSession } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";

export function transferSessionHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const sessionBinding = recipe.matchBindings.find((binding) => binding.role === "session");
  const toBinding = recipe.matchBindings.find((binding) => binding.role === "to");
  const fromBinding = recipe.matchBindings.find((binding) => binding.role === "from");

  if (sessionBinding?.role !== "session" || toBinding?.role !== "to") {
    return { ok: false, reason: "transfer_session requires session and to bindings" };
  }

  const session = before.sessions.get(sessionBinding.sessionId);
  if (session === undefined) {
    return { ok: false, reason: `session not found: ${sessionBinding.sessionId}` };
  }

  if (fromBinding?.role === "from" && session.controller !== fromBinding.actorId) {
    return { ok: false, reason: "transfer_session requires from to be current controller" };
  }

  const participants = session.participants.includes(toBinding.actorId)
    ? session.participants
    : [...session.participants, toBinding.actorId];

  const after = withSession(
    before,
    communicationSession(session.sessionId, toBinding.actorId, participants, session.visibility),
  );

  const involvedIds = [
    ...(fromBinding?.role === "from" ? [fromBinding.actorId] : []),
    toBinding.actorId,
  ];

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, involvedIds),
    createdSessionRefs: [],
  };
}
