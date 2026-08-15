import type { CollaborationSnapshot } from "@cantilune/core";
import { withParticipant, participant } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";
import { validateTransition } from "../../cluster/lifecycleTransitions.js";

export function signalDoneHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = recipe.matchBindings.find((b) => b.role === "from");
  if (fromBinding?.role !== "from") {
    return { ok: false, reason: "signal_done requires 'from' binding" };
  }

  const current = before.participants.get(fromBinding.actorId);
  if (current === undefined) {
    return { ok: false, reason: `participant not found: ${fromBinding.actorId as string}` };
  }

  if (!validateTransition(current.status, "done")) {
    return {
      ok: false,
      reason: `invalid lifecycle transition: ${current.status} → done`,
    };
  }

  const after = withParticipant(before, participant(fromBinding.actorId, current.kind, "done"));

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, [fromBinding.actorId]),
    createdSessionRefs: [],
  };
}
