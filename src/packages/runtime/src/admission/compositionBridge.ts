import type {
  ActorId,
  CompositionIntent,
  CoordinationIntent,
  MatchBinding,
  TargetRef,
} from "@cantilune/core";
import {
  coordinationIntent,
  matchBinding,
  operationTypeId,
  operationTypeForOperator,
} from "@cantilune/core";
import {
  bindingsForCreateSession,
  bindingsForForkBranch,
  bindingsForPublishArtifact,
  bindingsForTransferSession,
} from "./compositionBindings.js";

/**
 * Maps CompositionIntent targets to named MatchBindings for runtime admission.
 * Core {@link toCoordinationIntent} uses lossy targets→bindings fallback (artifact→artifact role);
 * runtime requires template roles (task/from/to/capability).
 */
export function coordinationIntentFromComposition(
  composition: CompositionIntent,
): CoordinationIntent {
  const operation = operationTypeId(operationTypeForOperator(composition.operator));
  const bindings = matchBindingsForComposition(composition);
  return coordinationIntent(
    composition.initiator,
    operation,
    bindings,
    undefined,
    composition.inputContentRefs,
  );
}

function matchBindingsForComposition(composition: CompositionIntent): MatchBinding[] {
  switch (composition.operator) {
    case "attach":
    case "isolate":
      return bindingsForIntroduce(composition.targets, composition.initiator.actorId);
    case "fork":
      return bindingsForForkBranch(composition.targets, composition.initiator.actorId);
    case "delegate":
      return bindingsForDelegate(composition.targets, composition.initiator.actorId);
    case "nest":
      return bindingsForCreateSession(composition.targets, composition.initiator.actorId);
    case "rewire":
      return bindingsForTransferSession(composition.targets, composition.initiator.actorId);
    case "close":
      return bindingsForPublishArtifact(composition.targets, composition.initiator.actorId);
  }
}

function bindingsForIntroduce(targets: readonly TargetRef[], initiatorId: ActorId): MatchBinding[] {
  const bindings: MatchBinding[] = [];
  const artifact = targets.find((target) => target.kind === "artifact");
  const participant =
    targets.find((target) => target.kind === "participant" && target.id === initiatorId) ??
    targets.find((target) => target.kind === "participant");
  const capability = targets.find((target) => target.kind === "capability");

  if (artifact !== undefined) {
    bindings.push(matchBinding("task", artifact.id));
  }
  if (participant !== undefined) {
    bindings.push(matchBinding("from", participant.id));
  }
  if (capability !== undefined) {
    bindings.push(matchBinding("capability", capability.id));
  }
  return bindings;
}

function bindingsForDelegate(targets: readonly TargetRef[], initiatorId: ActorId): MatchBinding[] {
  const bindings: MatchBinding[] = [];
  const artifact = targets.find((target) => target.kind === "artifact");
  const capability = targets.find((target) => target.kind === "capability");
  const participants = targets.filter((target) => target.kind === "participant");
  const from = participants.find((target) => target.id === initiatorId) ?? participants[0];
  const to = participants.find((target) => target.id !== from?.id) ?? participants[1];

  if (artifact !== undefined) {
    bindings.push(matchBinding("task", artifact.id));
  }
  if (from !== undefined) {
    bindings.push(matchBinding("from", from.id));
  }
  if (to !== undefined) {
    bindings.push(matchBinding("to", to.id));
  }
  if (capability !== undefined) {
    bindings.push(matchBinding("capability", capability.id));
  }
  return bindings;
}
