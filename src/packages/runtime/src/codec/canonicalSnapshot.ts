import type {
  ArtifactId,
  CapabilityId,
  CollaborationSnapshot,
  LinkId,
  SessionId,
} from "@cantilune/core";

function sortedEntries<K extends string, V>(map: ReadonlyMap<K, V>): [K, V][] {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function observationEqual(
  left: CollaborationSnapshot["auditTail"][number],
  right: CollaborationSnapshot["auditTail"][number],
): boolean {
  return (
    left.sequenceNo === right.sequenceNo &&
    left.payloadRef === right.payloadRef &&
    left.receivedAt === right.receivedAt &&
    left.source.actorId === right.source.actorId &&
    left.source.kind === right.source.kind
  );
}

/** Canonical deep equivalence — ignores snapshotRef identity, compares world content. */
export function snapshotsCanonicallyEqual(
  left: CollaborationSnapshot,
  right: CollaborationSnapshot,
): boolean {
  if (left.epochId !== right.epochId) {
    return false;
  }
  if (!auditTailsEqual(left, right)) {
    return false;
  }
  if (!retiredEntitiesEqual(left, right)) {
    return false;
  }
  if (!participantsEqual(left, right)) {
    return false;
  }
  if (!mapEntitiesEqual(left.artifacts, right.artifacts, compareArtifact)) {
    return false;
  }
  if (!mapEntitiesEqual(left.capabilities, right.capabilities, compareCapability)) {
    return false;
  }
  if (!mapEntitiesEqual(left.sessions, right.sessions, compareSession)) {
    return false;
  }
  if (!mapEntitiesEqual(left.links, right.links, compareLink)) {
    return false;
  }
  if (!heartbeatLogsEqual(left, right)) {
    return false;
  }
  return policyContextsEqual(left, right);
}

/**
 * Compared because it was not: the snapshot wire format dropped the heartbeat
 * log, and replay verification could not detect the loss while this equality
 * ignored the field.
 */
function heartbeatLogsEqual(left: CollaborationSnapshot, right: CollaborationSnapshot): boolean {
  if (left.heartbeatLog.length !== right.heartbeatLog.length) {
    return false;
  }
  for (let i = 0; i < left.heartbeatLog.length; i++) {
    const l = left.heartbeatLog[i];
    const r = right.heartbeatLog[i];
    if (l === undefined || r === undefined) {
      return false;
    }
    if (
      l.agentId !== r.agentId ||
      l.sequenceNo !== r.sequenceNo ||
      l.emittedAt !== r.emittedAt ||
      l.turnCount !== r.turnCount ||
      l.lastAction !== r.lastAction
    ) {
      return false;
    }
  }
  return true;
}

function auditTailsEqual(left: CollaborationSnapshot, right: CollaborationSnapshot): boolean {
  if (left.auditTail.length !== right.auditTail.length) {
    return false;
  }
  for (let i = 0; i < left.auditTail.length; i++) {
    const l = left.auditTail[i];
    const r = right.auditTail[i];
    if (l === undefined || r === undefined || !observationEqual(l, r)) {
      return false;
    }
  }
  return true;
}

function retiredEntitiesEqual(left: CollaborationSnapshot, right: CollaborationSnapshot): boolean {
  if (left.retiredEntities.length !== right.retiredEntities.length) {
    return false;
  }
  for (let i = 0; i < left.retiredEntities.length; i++) {
    const l = left.retiredEntities[i];
    const r = right.retiredEntities[i];
    if (l === undefined || r === undefined) {
      return false;
    }
    if (
      l.entityId !== r.entityId ||
      l.entityKind !== r.entityKind ||
      l.retiredAt !== r.retiredAt ||
      l.reasonRef !== r.reasonRef
    ) {
      return false;
    }
  }
  return true;
}

function participantsEqual(left: CollaborationSnapshot, right: CollaborationSnapshot): boolean {
  const participantEntries = sortedEntries(left.participants);
  const rightParticipants = sortedEntries(right.participants);
  if (participantEntries.length !== rightParticipants.length) {
    return false;
  }
  for (let i = 0; i < participantEntries.length; i++) {
    const [id, participant] = participantEntries[i] ?? [];
    const [rid, rparticipant] = rightParticipants[i] ?? [];
    if (
      id !== rid ||
      participant?.actorId !== rparticipant?.actorId ||
      participant?.kind !== rparticipant?.kind ||
      participant?.status !== rparticipant?.status
    ) {
      return false;
    }
  }
  return true;
}

function policyContextsEqual(left: CollaborationSnapshot, right: CollaborationSnapshot): boolean {
  return (
    JSON.stringify(left.policyContext.approvalState) ===
      JSON.stringify(right.policyContext.approvalState) &&
    JSON.stringify(left.policyContext.retryState) === JSON.stringify(right.policyContext.retryState)
  );
}

function mapEntitiesEqual<K extends string, V>(
  left: ReadonlyMap<K, V>,
  right: ReadonlyMap<K, V>,
  compare: (left: V, right: V) => boolean,
): boolean {
  const leftEntries = sortedEntries(left);
  const rightEntries = sortedEntries(right);
  if (leftEntries.length !== rightEntries.length) {
    return false;
  }
  for (let i = 0; i < leftEntries.length; i++) {
    const [id, value] = leftEntries[i] ?? [];
    const [rid, rvalue] = rightEntries[i] ?? [];
    if (id !== rid || value === undefined || rvalue === undefined || !compare(value, rvalue)) {
      return false;
    }
  }
  return true;
}

function compareArtifact(
  left: CollaborationSnapshot["artifacts"] extends ReadonlyMap<ArtifactId, infer V> ? V : never,
  right: CollaborationSnapshot["artifacts"] extends ReadonlyMap<ArtifactId, infer V> ? V : never,
): boolean {
  return (
    left.artifactId === right.artifactId &&
    left.kind === right.kind &&
    left.contentRef === right.contentRef &&
    left.lifecycle === right.lifecycle &&
    left.owner.actorId === right.owner.actorId &&
    left.owner.kind === right.owner.kind
  );
}

function compareCapability(
  left: CollaborationSnapshot["capabilities"] extends ReadonlyMap<CapabilityId, infer V>
    ? V
    : never,
  right: CollaborationSnapshot["capabilities"] extends ReadonlyMap<CapabilityId, infer V>
    ? V
    : never,
): boolean {
  return (
    left.capabilityId === right.capabilityId &&
    left.kind === right.kind &&
    left.holder === right.holder &&
    JSON.stringify(left.scope) === JSON.stringify(right.scope)
  );
}

function compareSession(
  left: CollaborationSnapshot["sessions"] extends ReadonlyMap<SessionId, infer V> ? V : never,
  right: CollaborationSnapshot["sessions"] extends ReadonlyMap<SessionId, infer V> ? V : never,
): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.controller === right.controller &&
    left.visibility === right.visibility &&
    [...left.participants].sort((a, b) => a.localeCompare(b)).join(",") ===
      [...right.participants].sort((a, b) => a.localeCompare(b)).join(",")
  );
}

function compareLink(
  left: CollaborationSnapshot["links"] extends ReadonlyMap<LinkId, infer V> ? V : never,
  right: CollaborationSnapshot["links"] extends ReadonlyMap<LinkId, infer V> ? V : never,
): boolean {
  return (
    left.linkId === right.linkId &&
    left.kind === right.kind &&
    JSON.stringify(left.from) === JSON.stringify(right.from) &&
    JSON.stringify(left.to) === JSON.stringify(right.to)
  );
}
