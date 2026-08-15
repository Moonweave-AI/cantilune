import type { ActorId, MatchBinding, TargetRef } from "@cantilune/core";
import { matchBinding } from "@cantilune/core";

export function bindingsForCreateSession(
  targets: readonly TargetRef[],
  initiatorId: ActorId,
): MatchBinding[] {
  const bindings: MatchBinding[] = [];
  const session = targets.find((target) => target.kind === "session");
  const controller =
    targets.find((target) => target.kind === "participant" && target.id === initiatorId) ??
    targets.find((target) => target.kind === "participant");

  if (controller !== undefined) {
    bindings.push(matchBinding("from", controller.id));
  }
  if (session !== undefined) {
    bindings.push(matchBinding("session", session.id));
  }

  for (const target of targets.filter((item) => item.kind === "participant")) {
    if (target.id !== controller?.id) {
      bindings.push(matchBinding("participant", target.id));
    }
  }
  return bindings;
}

export function bindingsForForkBranch(
  targets: readonly TargetRef[],
  initiatorId: ActorId,
): MatchBinding[] {
  const bindings: MatchBinding[] = [];
  bindings.push(matchBinding("from", initiatorId));

  const artifact = targets.find((target) => target.kind === "artifact");
  const capability = targets.find((target) => target.kind === "capability");
  if (artifact !== undefined) {
    bindings.push(matchBinding("task", artifact.id));
  }
  if (capability !== undefined) {
    bindings.push(matchBinding("capability", capability.id));
  }

  for (const target of targets.filter((item) => item.kind === "participant")) {
    if (target.id !== initiatorId) {
      bindings.push(matchBinding("participant", target.id));
    }
  }
  return bindings;
}

export function bindingsForPublishArtifact(
  targets: readonly TargetRef[],
  initiatorId: ActorId,
): MatchBinding[] {
  const bindings: MatchBinding[] = [];
  const artifact = targets.find((target) => target.kind === "artifact");
  const owner =
    targets.find((target) => target.kind === "participant" && target.id === initiatorId) ??
    targets.find((target) => target.kind === "participant");

  if (artifact !== undefined) {
    bindings.push(matchBinding("task", artifact.id));
  }
  if (owner !== undefined) {
    bindings.push(matchBinding("from", owner.id));
  }
  return bindings;
}

export function bindingsForTransferSession(
  targets: readonly TargetRef[],
  initiatorId: ActorId,
): MatchBinding[] {
  const bindings: MatchBinding[] = [];
  const session = targets.find((target) => target.kind === "session");
  const participants = targets.filter((target) => target.kind === "participant");
  const from = participants.find((target) => target.id === initiatorId) ?? participants[0];
  const to = participants.find((target) => target.id !== from?.id) ?? participants[1];

  if (session !== undefined) {
    bindings.push(matchBinding("session", session.id));
  }
  if (from !== undefined) {
    bindings.push(matchBinding("from", from.id));
  }
  if (to !== undefined) {
    bindings.push(matchBinding("to", to.id));
  }
  return bindings;
}
