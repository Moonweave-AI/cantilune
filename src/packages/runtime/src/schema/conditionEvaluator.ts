import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  CollaborationSnapshot,
  MatchBinding,
  SessionId,
} from "@cantilune/core";
import type { TemplateCondition } from "./operationTemplate.js";

function bindingByRole(
  bindings: readonly MatchBinding[],
  role: MatchBinding["role"],
): MatchBinding | undefined {
  return bindings.find((binding) => binding.role === role);
}

function artifactIdFromRole(
  bindings: readonly MatchBinding[],
  role: MatchBinding["role"],
): ArtifactId | undefined {
  const binding = bindingByRole(bindings, role);
  if (binding === undefined) {
    return undefined;
  }
  if (binding.role === "task" || binding.role === "artifact") {
    return binding.artifactId;
  }
  return undefined;
}

function actorIdFromRole(
  bindings: readonly MatchBinding[],
  role: MatchBinding["role"],
): ActorId | undefined {
  const binding = bindingByRole(bindings, role);
  if (binding === undefined) {
    return undefined;
  }
  if (
    binding.role === "from" ||
    binding.role === "to" ||
    binding.role === "delegator" ||
    binding.role === "delegatee" ||
    binding.role === "participant"
  ) {
    return binding.actorId;
  }
  return undefined;
}

function capabilityIdFromRole(
  bindings: readonly MatchBinding[],
  role: MatchBinding["role"],
): CapabilityId | undefined {
  const binding = bindingByRole(bindings, role);
  if (binding?.role === "capability") {
    return binding.capabilityId;
  }
  return undefined;
}

function sessionIdFromRole(
  bindings: readonly MatchBinding[],
  role: MatchBinding["role"],
): SessionId | undefined {
  const binding = bindingByRole(bindings, role);
  if (binding?.role === "session") {
    return binding.sessionId;
  }
  return undefined;
}

function resolveRole(
  bindings: readonly MatchBinding[],
  paramBindings: Readonly<Record<string, MatchBinding["role"]>>,
  param: string,
): MatchBinding["role"] | undefined {
  return paramBindings[param];
}

/**
 * The delegator holds the task either through an explicit write capability
 * scoped to it, or by owning the artifact outright when no capability is bound.
 */
function evaluateDelegatorHolds(
  snapshot: CollaborationSnapshot,
  bindings: readonly MatchBinding[],
  condition: TemplateCondition,
): boolean {
  const taskRole = resolveRole(bindings, condition.bindings, "task") ?? "task";
  const fromRole = resolveRole(bindings, condition.bindings, "from") ?? "from";
  const capRole = resolveRole(bindings, condition.bindings, "capability") ?? "capability";
  const artifactId = artifactIdFromRole(bindings, taskRole);
  const actorId = actorIdFromRole(bindings, fromRole);
  const capabilityId = capabilityIdFromRole(bindings, capRole);

  if (artifactId === undefined || actorId === undefined) {
    return false;
  }

  if (capabilityId === undefined) {
    return snapshot.artifacts.get(artifactId)?.owner.actorId === actorId;
  }

  const capability = snapshot.capabilities.get(capabilityId);
  return (
    capability !== undefined &&
    capability.holder === actorId &&
    capability.scope.kind === "artifact" &&
    capability.scope.artifactId === artifactId
  );
}

/** The session named by the condition is controlled by the acting participant. */
function evaluateSessionController(
  snapshot: CollaborationSnapshot,
  bindings: readonly MatchBinding[],
  condition: TemplateCondition,
): boolean {
  const sessionRole = resolveRole(bindings, condition.bindings, "session") ?? "session";
  const fromRole = resolveRole(bindings, condition.bindings, "from") ?? "from";
  const sessionId = sessionIdFromRole(bindings, sessionRole);
  const actorId = actorIdFromRole(bindings, fromRole);

  if (sessionId === undefined || actorId === undefined) {
    return false;
  }
  return snapshot.sessions.get(sessionId)?.controller === actorId;
}

export function evaluateCondition(
  snapshot: CollaborationSnapshot,
  bindings: readonly MatchBinding[],
  condition: TemplateCondition,
): boolean {
  switch (condition.kind) {
    case "task.exists": {
      const role = resolveRole(bindings, condition.bindings, "task") ?? "task";
      const artifactId = artifactIdFromRole(bindings, role);
      return artifactId !== undefined && snapshot.artifacts.has(artifactId);
    }
    case "task.not_exists": {
      const role = resolveRole(bindings, condition.bindings, "task") ?? "task";
      const artifactId = artifactIdFromRole(bindings, role);
      return artifactId !== undefined && !snapshot.artifacts.has(artifactId);
    }
    case "session.exists": {
      const role = resolveRole(bindings, condition.bindings, "session") ?? "session";
      const sessionId = sessionIdFromRole(bindings, role);
      return sessionId !== undefined && snapshot.sessions.has(sessionId);
    }
    case "session.controller_matches":
      return evaluateSessionController(snapshot, bindings, condition);
    case "delegator.holds":
      return evaluateDelegatorHolds(snapshot, bindings, condition);
    case "delegatee.can_accept": {
      const toRole = resolveRole(bindings, condition.bindings, "to") ?? "to";
      const actorId = actorIdFromRole(bindings, toRole);
      return actorId !== undefined && snapshot.participants.has(actorId);
    }
    case "participant.registered": {
      const role = resolveRole(bindings, condition.bindings, "participant") ?? "from";
      const actorId = actorIdFromRole(bindings, role);
      return actorId !== undefined && snapshot.participants.has(actorId);
    }
  }
}

export function evaluateRequires(
  snapshot: CollaborationSnapshot,
  bindings: readonly MatchBinding[],
  requires: readonly TemplateCondition[],
): TemplateCondition | undefined {
  for (const condition of requires) {
    if (!evaluateCondition(snapshot, bindings, condition)) {
      return condition;
    }
  }
  return undefined;
}

/** Post-apply template ensures — same interpreter as requires. */
export function evaluateEnsures(
  snapshot: CollaborationSnapshot,
  bindings: readonly MatchBinding[],
  ensures: readonly TemplateCondition[],
): TemplateCondition | undefined {
  return evaluateRequires(snapshot, bindings, ensures);
}
