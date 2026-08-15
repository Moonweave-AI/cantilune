import type { CollaborationSnapshot } from "@cantilune/core";
import { appendHeartbeat, nextHeartbeatSeq } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";

export function emitHeartbeatHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = recipe.matchBindings.find((b) => b.role === "from");
  if (fromBinding?.role !== "from") {
    return { ok: false, reason: "emit_heartbeat requires 'from' binding" };
  }

  const current = before.participants.get(fromBinding.actorId);
  if (current === undefined || current.status === "retired") {
    return {
      ok: false,
      reason: "cannot heartbeat from non-existent or retired participant",
    };
  }

  if (recipe.emittedAt === undefined) {
    return {
      ok: false,
      reason: "emit_heartbeat recipe missing replay-authoritative emittedAt",
    };
  }

  const scalarNames = Object.keys(recipe.scalarInputs);
  if (
    scalarNames.length !== 2 ||
    !Object.hasOwn(recipe.scalarInputs, "turnCount") ||
    !Object.hasOwn(recipe.scalarInputs, "lastAction")
  ) {
    return {
      ok: false,
      reason: "emit_heartbeat requires exactly scalar inputs 'turnCount' and 'lastAction'",
    };
  }
  const turnCount = recipe.scalarInputs["turnCount"];
  if (typeof turnCount !== "number" || !Number.isSafeInteger(turnCount) || turnCount < 0) {
    return {
      ok: false,
      reason: "emit_heartbeat scalar input 'turnCount' must be a non-negative safe integer",
    };
  }
  const lastAction = recipe.scalarInputs["lastAction"];
  if (typeof lastAction !== "string" || lastAction.length === 0) {
    return {
      ok: false,
      reason: "emit_heartbeat scalar input 'lastAction' must be a non-empty string",
    };
  }

  const after = appendHeartbeat(before, {
    agentId: fromBinding.actorId,
    sequenceNo: nextHeartbeatSeq(before.heartbeatLog, fromBinding.actorId),
    emittedAt: recipe.emittedAt,
    turnCount,
    lastAction,
  });

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, [fromBinding.actorId]),
    createdSessionRefs: [],
  };
}
