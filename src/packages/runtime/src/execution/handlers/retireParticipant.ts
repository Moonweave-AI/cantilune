import type { CollaborationSnapshot } from "@cantilune/core";
import { withParticipant, participant } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";
import { validateTransition } from "../../cluster/lifecycleTransitions.js";

export function retireParticipantHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = recipe.matchBindings.find((b) => b.role === "from");
  const participantBinding = recipe.matchBindings.find((b) => b.role === "participant");

  if (fromBinding?.role !== "from") {
    return { ok: false, reason: "retire_participant requires 'from' binding" };
  }

  const targetId =
    participantBinding?.role === "participant" ? participantBinding.actorId : fromBinding.actorId;

  const current = before.participants.get(targetId);
  if (current === undefined) {
    return { ok: false, reason: `participant not found: ${targetId as string}` };
  }

  if (!validateTransition(current.status, "retired")) {
    return {
      ok: false,
      reason: `invalid lifecycle transition: ${current.status} → retired`,
    };
  }

  const after = withParticipant(before, participant(targetId, current.kind, "retired"));

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, [fromBinding.actorId, targetId]),
    createdSessionRefs: [],
  };
}
