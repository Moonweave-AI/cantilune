import type { CollaborationSnapshot } from "@cantilune/core";
import { withParticipant, participant } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";

export function registerParticipantHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = recipe.matchBindings.find((b) => b.role === "from");
  const participantBinding = recipe.matchBindings.find((b) => b.role === "participant");

  if (fromBinding?.role !== "from") {
    return { ok: false, reason: "register_participant requires 'from' binding" };
  }
  if (participantBinding?.role !== "participant") {
    return { ok: false, reason: "register_participant requires 'participant' binding" };
  }

  const fromParticipant = before.participants.get(fromBinding.actorId);
  if (fromParticipant === undefined) {
    return { ok: false, reason: `initiator not found: ${fromBinding.actorId as string}` };
  }
  if (fromParticipant.status !== "active") {
    return {
      ok: false,
      reason: `initiator must be active, got: ${fromParticipant.status}`,
    };
  }

  if (before.participants.has(participantBinding.actorId)) {
    return { ok: false, reason: "participant already registered" };
  }

  const after = withParticipant(
    before,
    participant(participantBinding.actorId, "agent", "registered"),
  );

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(after, [fromBinding.actorId, participantBinding.actorId]),
    createdSessionRefs: [],
  };
}
