import type { CollaborationSnapshot } from "@cantilune/core";
import { withParticipant, participant } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";
import { validateTransition } from "../../cluster/lifecycleTransitions.js";

/**
 * `activate_participant` — admits a registered participant to `active` and binds
 * its content-addressed agent manifest (ADR-0015).
 *
 * Activation authority: the `from` participant must already be `active` (the
 * Owner-decided "active initiator admits" rule, the same authority
 * `register_participant` uses). The target `participant` must be in a state
 * that may transition to `active` (`registered`, `waiting`, or `blocked`).
 *
 * The manifest ref is carried on the recipe as `inputContentRefs[0]`, the same
 * channel `introduce_artifact` uses for its content ref. An `agent` participant
 * cannot be activated without a manifest ref; non-agent participants (human,
 * runtime, environment) have no manifest and are rejected if one is supplied.
 * Content-addressed digest verification and `AgentManifest.agentId` matching
 * happen at launch time in the supervisor, which is the layer that owns the
 * content store (ADR-0003 runtime content boundary).
 */
export function activateParticipantHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = recipe.matchBindings.find((b) => b.role === "from");
  const participantBinding = recipe.matchBindings.find((b) => b.role === "participant");

  if (fromBinding?.role !== "from") {
    return { ok: false, reason: "activate_participant requires 'from' binding" };
  }
  if (participantBinding?.role !== "participant") {
    return { ok: false, reason: "activate_participant requires 'participant' binding" };
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

  const target = before.participants.get(participantBinding.actorId);
  if (target === undefined) {
    return {
      ok: false,
      reason: `participant not found: ${participantBinding.actorId as string}`,
    };
  }

  if (!validateTransition(target.status, "active")) {
    return {
      ok: false,
      reason: `invalid lifecycle transition: ${target.status} → active`,
    };
  }

  const manifestRef = recipe.inputContentRefs[0];
  if (target.kind === "agent") {
    if (manifestRef === undefined) {
      return {
        ok: false,
        reason: "activate_participant requires a manifest ref for agent participants",
      };
    }
  } else if (manifestRef !== undefined) {
    return {
      ok: false,
      reason: `activate_participant does not accept a manifest ref for non-agent participants (kind: ${target.kind})`,
    };
  }

  const after = withParticipant(
    before,
    participant(
      participantBinding.actorId,
      target.kind,
      "active",
      manifestRef,
    ),
  );

  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(after, [fromBinding.actorId, participantBinding.actorId]),
    createdSessionRefs: [],
  };
}
