import type { CollaborationSnapshot } from "../coordination/collaborationSnapshot.js";
import type { LinkEndpoint } from "../nodes/collaborationLink.js";
import type { ObservationEntry } from "../nodes/observationEntry.js";
import type { ActorRef, Participant } from "../nodes/participant.js";
import { resolveActorRef } from "../nodes/participant.js";
import type { PolicyContext } from "../nodes/policyContext.js";
import type { ActorId } from "../primitives/ids.js";
import type { CoreViolation } from "../primitives/violation.js";
import { coreViolation, throwCore } from "../primitives/violation.js";

type ValidationResult = { ok: false; error: CoreViolation } | undefined;

export function validateSnapshotIntegrity(snapshot: CollaborationSnapshot): void {
  const result = validateSnapshotIntegrityResult(snapshot);
  if (!result.ok) {
    throwCore(result.error);
  }
}

export function validateSnapshotIntegrityResult(
  snapshot: CollaborationSnapshot,
): { ok: true } | { ok: false; error: CoreViolation } {
  const participantIds = new Set(snapshot.participants.keys());

  const participantsCheck = validateParticipants(snapshot);
  if (participantsCheck !== undefined) {
    return participantsCheck;
  }

  const artifactsCheck = validateArtifacts(snapshot);
  if (artifactsCheck !== undefined) {
    return artifactsCheck;
  }

  const policyCheck = validatePolicyContext(snapshot.policyContext, participantIds);
  if (policyCheck !== undefined) {
    return policyCheck;
  }

  const auditCheck = validateAuditTail(snapshot.auditTail, snapshot.participants);
  if (auditCheck !== undefined) {
    return auditCheck;
  }

  const capabilitiesCheck = validateCapabilities(snapshot, participantIds);
  if (capabilitiesCheck !== undefined) {
    return capabilitiesCheck;
  }

  const sessionsCheck = validateSessions(snapshot, participantIds);
  if (sessionsCheck !== undefined) {
    return sessionsCheck;
  }

  const linksCheck = validateLinks(snapshot);
  if (linksCheck !== undefined) {
    return linksCheck;
  }

  const retiredCheck = validateRetiredEntities(snapshot);
  if (retiredCheck !== undefined) {
    return retiredCheck;
  }

  const namespaceCheck = validateNamespaces(snapshot);
  if (namespaceCheck !== undefined) {
    return namespaceCheck;
  }

  const transcriptCheck = validateTranscripts(snapshot, participantIds);
  if (transcriptCheck !== undefined) {
    return transcriptCheck;
  }

  const accessCheck = validateTranscriptAccessRequests(snapshot, participantIds);
  if (accessCheck !== undefined) {
    return accessCheck;
  }

  return { ok: true };
}

function validateParticipants(
  snapshot: CollaborationSnapshot,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, participant] of snapshot.participants) {
    if (key !== participant.actorId) {
      return fail(
        "snapshot_integrity",
        "participant map key does not match actorId",
        `participants[${key}]`,
      );
    }
    if (
      participant.namespaceId !== undefined &&
      !snapshot.namespaces.has(participant.namespaceId)
    ) {
      return fail(
        "snapshot_integrity",
        "participant namespace is not registered",
        `participants[${key}].namespaceId`,
      );
    }
  }
  return undefined;
}

function validateNamespaces(
  snapshot: CollaborationSnapshot,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, namespace] of snapshot.namespaces) {
    if (key !== namespace.namespaceId) {
      return fail(
        "snapshot_integrity",
        "namespace map key does not match namespaceId",
        `namespaces[${key}]`,
      );
    }
  }
  return undefined;
}

function validateTranscripts(
  snapshot: CollaborationSnapshot,
  participantIds: ReadonlySet<ActorId>,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, transcript] of snapshot.transcripts) {
    if (key !== transcript.actorId) {
      return fail(
        "snapshot_integrity",
        "transcript map key does not match actorId",
        `transcripts[${key}]`,
      );
    }
    const ownerCheck = requireRegisteredActor(
      transcript.actorId,
      participantIds,
      `transcripts[${key}].actorId`,
    );
    if (ownerCheck !== undefined) {
      return ownerCheck;
    }
    if (!snapshot.namespaces.has(transcript.namespaceId)) {
      return fail(
        "snapshot_integrity",
        "transcript namespace is not registered",
        `transcripts[${key}].namespaceId`,
      );
    }
  }
  return undefined;
}

function validateTranscriptAccessRequests(
  snapshot: CollaborationSnapshot,
  participantIds: ReadonlySet<ActorId>,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, request] of snapshot.transcriptAccessRequests) {
    if (key !== request.requestId) {
      return fail(
        "snapshot_integrity",
        "transcript access request map key does not match requestId",
        `transcriptAccessRequests[${key}]`,
      );
    }
    const requesterCheck = validateActorRef(
      request.requester,
      snapshot.participants,
      `transcriptAccessRequests[${key}].requester`,
    );
    if (requesterCheck !== undefined) {
      return requesterCheck;
    }
    const subjectCheck = requireRegisteredActor(
      request.subjectActorId,
      participantIds,
      `transcriptAccessRequests[${key}].subjectActorId`,
    );
    if (subjectCheck !== undefined) {
      return subjectCheck;
    }
    if (!snapshot.namespaces.has(request.subjectNamespaceId)) {
      return fail(
        "snapshot_integrity",
        "transcript access request namespace is not registered",
        `transcriptAccessRequests[${key}].subjectNamespaceId`,
      );
    }
  }
  return undefined;
}

function validateArtifacts(
  snapshot: CollaborationSnapshot,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, artifact] of snapshot.artifacts) {
    if (key !== artifact.artifactId) {
      return fail(
        "snapshot_integrity",
        "artifact map key does not match artifactId",
        `artifacts[${key}]`,
      );
    }
    const ownerCheck = validateActorRef(
      artifact.owner,
      snapshot.participants,
      `artifacts[${artifact.artifactId}].owner`,
    );
    if (ownerCheck !== undefined) {
      return ownerCheck;
    }
  }
  return undefined;
}

function validateCapabilities(
  snapshot: CollaborationSnapshot,
  participantIds: ReadonlySet<ActorId>,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, capability] of snapshot.capabilities) {
    if (key !== capability.capabilityId) {
      return fail(
        "snapshot_integrity",
        "capability map key does not match capabilityId",
        `capabilities[${key}]`,
      );
    }
    const holderCheck = requireRegisteredActor(
      capability.holder,
      participantIds,
      `capabilities[${capability.capabilityId}].holder`,
    );
    if (holderCheck !== undefined) {
      return holderCheck;
    }
    if (
      capability.scope.kind === "artifact" &&
      !snapshot.artifacts.has(capability.scope.artifactId)
    ) {
      return fail(
        "snapshot_integrity",
        "capability scope references missing artifact",
        `capabilities[${capability.capabilityId}].scope`,
      );
    }
    if (capability.scope.kind === "session" && !snapshot.sessions.has(capability.scope.sessionId)) {
      return fail(
        "snapshot_integrity",
        "capability scope references missing session",
        `capabilities[${capability.capabilityId}].scope`,
      );
    }
    if (capability.scope.kind === "transcript") {
      if (!snapshot.participants.has(capability.scope.actorId)) {
        return fail(
          "snapshot_integrity",
          "capability scope references missing transcript actor",
          `capabilities[${capability.capabilityId}].scope`,
        );
      }
      if (!snapshot.namespaces.has(capability.scope.namespaceId)) {
        return fail(
          "snapshot_integrity",
          "capability scope references missing transcript namespace",
          `capabilities[${capability.capabilityId}].scope`,
        );
      }
    }
  }
  return undefined;
}

function validateSessions(
  snapshot: CollaborationSnapshot,
  participantIds: ReadonlySet<ActorId>,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, session] of snapshot.sessions) {
    if (key !== session.sessionId) {
      return fail(
        "snapshot_integrity",
        "session map key does not match sessionId",
        `sessions[${key}]`,
      );
    }
    const controllerCheck = requireRegisteredActor(
      session.controller,
      participantIds,
      `sessions[${session.sessionId}].controller`,
    );
    if (controllerCheck !== undefined) {
      return controllerCheck;
    }
    for (const member of session.participants) {
      const memberCheck = requireRegisteredActor(
        member,
        participantIds,
        `sessions[${session.sessionId}].participants`,
      );
      if (memberCheck !== undefined) {
        return memberCheck;
      }
    }
  }
  return undefined;
}

function validateLinks(
  snapshot: CollaborationSnapshot,
): { ok: false; error: CoreViolation } | undefined {
  for (const [key, link] of snapshot.links) {
    if (key !== link.linkId) {
      return fail("snapshot_integrity", "link map key does not match linkId", `links[${key}]`);
    }
    const fromCheck = validateLinkEndpoint(link.from, snapshot, `links[${link.linkId}].from`);
    if (fromCheck !== undefined) {
      return fromCheck;
    }
    const toCheck = validateLinkEndpoint(link.to, snapshot, `links[${link.linkId}].to`);
    if (toCheck !== undefined) {
      return toCheck;
    }
  }
  return undefined;
}

function validateRetiredEntities(
  snapshot: CollaborationSnapshot,
): { ok: false; error: CoreViolation } | undefined {
  for (const tombstone of snapshot.retiredEntities) {
    if (liveEntityExists(snapshot, tombstone.entityId, tombstone.entityKind)) {
      return fail(
        "snapshot_integrity",
        `live entity still present for tombstone ${tombstone.entityId}`,
        "retiredEntities",
      );
    }
  }
  return undefined;
}

function requireRegisteredActor(
  actorId: ActorId,
  participantIds: ReadonlySet<ActorId>,
  path: string,
): ValidationResult {
  if (!participantIds.has(actorId)) {
    return fail("actor_not_found", `unregistered actor ${actorId}`, path);
  }
  return undefined;
}

function validateActorRef(
  ref: ActorRef,
  participants: ReadonlyMap<ActorId, Participant>,
  path: string,
): ValidationResult {
  const resolved = resolveActorRef(ref, participants);
  if (resolved.ok) {
    return undefined;
  }
  if (resolved.error.kind === "not_found") {
    return fail("actor_not_found", `unregistered actor ${ref.actorId}`, path);
  }
  return fail(
    "actor_kind_mismatch",
    `actor kind mismatch for ${ref.actorId}: ref=${ref.kind}, registered=${resolved.error.actual}`,
    path,
    { expected: ref.kind, actual: resolved.error.actual },
  );
}

function validatePolicyContext(
  policyContext: PolicyContext,
  participantIds: ReadonlySet<ActorId>,
): ValidationResult {
  const approval = policyContext.approvalState;
  if (approval.kind !== "awaiting_review") {
    return undefined;
  }
  for (const reviewerId of approval.reviewers) {
    if (!participantIds.has(reviewerId as ActorId)) {
      return fail(
        "snapshot_integrity",
        `policy reviewer ${reviewerId} is not a registered participant`,
        "policyContext.approvalState.reviewers",
      );
    }
  }
  return undefined;
}

function validateAuditTail(
  auditTail: readonly ObservationEntry[],
  participants: ReadonlyMap<ActorId, Participant>,
): ValidationResult {
  for (let i = 0; i < auditTail.length; i++) {
    const entry = auditTail[i];
    if (entry === undefined) {
      continue;
    }
    const expectedSeq = i + 1;
    if (entry.sequenceNo !== expectedSeq) {
      return fail(
        "observation_sequence_invalid",
        `auditTail sequence gap at index ${i}: expected ${expectedSeq}, got ${entry.sequenceNo}`,
        `auditTail[${i}].sequenceNo`,
        { expected: String(expectedSeq), actual: String(entry.sequenceNo) },
      );
    }
    const sourceCheck = validateActorRef(entry.source, participants, `auditTail[${i}].source`);
    if (sourceCheck !== undefined) {
      return sourceCheck;
    }
  }
  return undefined;
}

function validateLinkEndpoint(
  endpoint: LinkEndpoint,
  snapshot: CollaborationSnapshot,
  path: string,
): ValidationResult {
  if (endpoint.kind === "participant") {
    return requireRegisteredActor(endpoint.actorId, new Set(snapshot.participants.keys()), path);
  }
  if (!snapshot.artifacts.has(endpoint.artifactId)) {
    return fail(
      "snapshot_integrity",
      `link endpoint references missing artifact ${endpoint.artifactId}`,
      path,
    );
  }
  return undefined;
}

function liveEntityExists(
  snapshot: CollaborationSnapshot,
  entityId: string,
  entityKind: string,
): boolean {
  switch (entityKind) {
    case "participant":
      return snapshot.participants.has(entityId as ActorId);
    case "artifact":
      return snapshot.artifacts.has(entityId as never);
    case "session":
      return snapshot.sessions.has(entityId as never);
    case "capability":
      return snapshot.capabilities.has(entityId as never);
    case "link":
      return snapshot.links.has(entityId as never);
    default:
      return false;
  }
}

function fail(
  code: CoreViolation["code"],
  message: string,
  path: string,
  details?: Pick<CoreViolation, "expected" | "actual">,
): { ok: false; error: CoreViolation } {
  return { ok: false, error: coreViolation(code, message, { path, ...details }) };
}
