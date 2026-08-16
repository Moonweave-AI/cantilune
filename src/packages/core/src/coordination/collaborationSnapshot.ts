import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  EpochId,
  LinkId,
  NamespaceId,
  SessionId,
  TranscriptAccessRequestId,
} from "../primitives/ids.js";
import { DEFAULT_NAMESPACE_ID } from "../primitives/ids.js";
import type { SnapshotRef } from "../primitives/refs.js";
import type { CollaborationLink, LinkEndpoint } from "../nodes/collaborationLink.js";
import type { CollaborationNamespace } from "../nodes/collaborationNamespace.js";
import { DEFAULT_NAMESPACE } from "../nodes/collaborationNamespace.js";
import type { CommunicationSession } from "../nodes/communicationSession.js";
import type { EntityTombstone } from "../nodes/entityTombstone.js";
import type { ObservationEntry } from "../nodes/observationEntry.js";
import type { ActorRef, Participant } from "../nodes/participant.js";
import type { ParticipantTranscript } from "../nodes/participantTranscript.js";
import { emptyPolicyContext as defaultPolicyContext } from "../nodes/policyContext.js";
import type { ApprovalState, PolicyContext, RetryState } from "../nodes/policyContext.js";
import type { CapabilityScope, ScopedCapability } from "../nodes/scopedCapability.js";
import type { TranscriptAccessRequest } from "../nodes/transcriptAccessRequest.js";
import type { WorkArtifact } from "../nodes/workArtifact.js";
import type { HeartbeatEntry, HeartbeatLog } from "./heartbeat.js";
import { clonePlainObject, cloneReadonlyArray, cloneReadonlyMap } from "../primitives/immutable.js";
import { appendToObservationStream, nextSequenceNo } from "./observationStream.js";

/**
 * Complete collaboration world at one instant (Config σ).
 *
 * **SnapshotRef semantics:** `snapshotRef` identifies a persisted snapshot version.
 * In-memory helpers (`appendObservation`, `with*`) return new objects but do not
 * assign a new ref — callers must invoke {@link withSnapshotRef} at commit boundaries.
 * `auditTail` is part of persisted snapshot identity for storage/replay, not graph structure.
 */
export interface CollaborationSnapshot {
  readonly snapshotRef: SnapshotRef;
  readonly epochId: EpochId;
  readonly participants: ReadonlyMap<ActorId, Participant>;
  readonly artifacts: ReadonlyMap<ArtifactId, WorkArtifact>;
  readonly links: ReadonlyMap<LinkId, CollaborationLink>;
  readonly sessions: ReadonlyMap<SessionId, CommunicationSession>;
  readonly capabilities: ReadonlyMap<CapabilityId, ScopedCapability>;
  readonly policyContext: PolicyContext;
  readonly auditTail: readonly ObservationEntry[];
  readonly retiredEntities: readonly EntityTombstone[];
  readonly heartbeatLog: HeartbeatLog;
  readonly namespaces: ReadonlyMap<NamespaceId, CollaborationNamespace>;
  readonly transcripts: ReadonlyMap<ActorId, ParticipantTranscript>;
  readonly transcriptAccessRequests: ReadonlyMap<
    TranscriptAccessRequestId,
    TranscriptAccessRequest
  >;
}

export interface CollaborationSnapshotInit {
  readonly snapshotRef: SnapshotRef;
  readonly epochId: EpochId;
  readonly participants?: ReadonlyMap<ActorId, Participant>;
  readonly artifacts?: ReadonlyMap<ArtifactId, WorkArtifact>;
  readonly links?: ReadonlyMap<LinkId, CollaborationLink>;
  readonly sessions?: ReadonlyMap<SessionId, CommunicationSession>;
  readonly capabilities?: ReadonlyMap<CapabilityId, ScopedCapability>;
  readonly policyContext?: PolicyContext;
  readonly auditTail?: readonly ObservationEntry[];
  readonly retiredEntities?: readonly EntityTombstone[];
  readonly heartbeatLog?: HeartbeatLog;
  readonly namespaces?: ReadonlyMap<NamespaceId, CollaborationNamespace>;
  readonly transcripts?: ReadonlyMap<ActorId, ParticipantTranscript>;
  readonly transcriptAccessRequests?: ReadonlyMap<
    TranscriptAccessRequestId,
    TranscriptAccessRequest
  >;
}

function cloneActorRef(ref: ActorRef): ActorRef {
  return clonePlainObject({ actorId: ref.actorId, kind: ref.kind });
}

function cloneParticipant(value: Participant): Participant {
  const base = clonePlainObject({
    actorId: value.actorId,
    kind: value.kind,
    status: value.status,
    namespaceId: value.namespaceId ?? DEFAULT_NAMESPACE_ID,
  });
  if (value.manifestRef !== undefined) {
    return { ...base, manifestRef: value.manifestRef };
  }
  return base;
}

function cloneWorkArtifact(value: WorkArtifact): WorkArtifact {
  return clonePlainObject({
    artifactId: value.artifactId,
    kind: value.kind,
    contentRef: value.contentRef,
    owner: cloneActorRef(value.owner),
    lifecycle: value.lifecycle,
  });
}

function cloneLinkEndpoint(value: LinkEndpoint): LinkEndpoint {
  if (value.kind === "participant") {
    return clonePlainObject({ kind: value.kind, actorId: value.actorId });
  }
  return clonePlainObject({ kind: value.kind, artifactId: value.artifactId });
}

function cloneCollaborationLink(value: CollaborationLink): CollaborationLink {
  return clonePlainObject({
    linkId: value.linkId,
    kind: value.kind,
    from: cloneLinkEndpoint(value.from),
    to: cloneLinkEndpoint(value.to),
  });
}

function cloneCommunicationSession(value: CommunicationSession): CommunicationSession {
  return clonePlainObject({
    sessionId: value.sessionId,
    controller: value.controller,
    participants: cloneReadonlyArray(value.participants),
    visibility: value.visibility,
  });
}

function cloneCapabilityScope(value: CapabilityScope): CapabilityScope {
  if (value.kind === "artifact") {
    return clonePlainObject({ kind: value.kind, artifactId: value.artifactId });
  }
  if (value.kind === "transcript") {
    return clonePlainObject({
      kind: value.kind,
      actorId: value.actorId,
      namespaceId: value.namespaceId,
    });
  }
  return clonePlainObject({ kind: value.kind, sessionId: value.sessionId });
}

function cloneNamespace(value: CollaborationNamespace): CollaborationNamespace {
  return clonePlainObject({
    namespaceId: value.namespaceId,
    displayName: value.displayName,
    adminPrincipals: cloneReadonlyArray(value.adminPrincipals),
  });
}

function cloneTranscript(value: ParticipantTranscript): ParticipantTranscript {
  return clonePlainObject({
    actorId: value.actorId,
    namespaceId: value.namespaceId,
    revision: value.revision,
    messages: cloneReadonlyArray(value.messages, (message) => clonePlainObject(message)),
  });
}

function cloneTranscriptAccessRequest(value: TranscriptAccessRequest): TranscriptAccessRequest {
  const base = clonePlainObject({
    requestId: value.requestId,
    requester: cloneActorRef(value.requester),
    subjectActorId: value.subjectActorId,
    subjectNamespaceId: value.subjectNamespaceId,
    status: value.status,
  });
  if (value.decidedBy !== undefined) {
    return { ...base, decidedBy: cloneActorRef(value.decidedBy) };
  }
  return base;
}

function cloneScopedCapability(value: ScopedCapability): ScopedCapability {
  return clonePlainObject({
    capabilityId: value.capabilityId,
    kind: value.kind,
    holder: value.holder,
    scope: cloneCapabilityScope(value.scope),
  });
}

function cloneApprovalState(value: ApprovalState): ApprovalState {
  if (value.kind === "awaiting_review") {
    return clonePlainObject({
      kind: value.kind,
      reviewers: cloneReadonlyArray(value.reviewers),
    });
  }
  if (value.kind === "approved" || value.kind === "rejected") {
    return clonePlainObject({ kind: value.kind, evidenceRef: value.evidenceRef });
  }
  return clonePlainObject({ kind: value.kind });
}

function cloneRetryState(value: RetryState): RetryState {
  if (value.kind === "awaiting_feedback") {
    return clonePlainObject({ kind: value.kind, attempt: value.attempt });
  }
  return clonePlainObject({ kind: value.kind });
}

function clonePolicyContext(context: PolicyContext): PolicyContext {
  return clonePlainObject({
    approvalState: cloneApprovalState(context.approvalState),
    retryState: cloneRetryState(context.retryState),
  });
}

function cloneObservationEntry(value: ObservationEntry): ObservationEntry {
  return clonePlainObject({
    sequenceNo: value.sequenceNo,
    source: cloneActorRef(value.source),
    payloadRef: value.payloadRef,
    receivedAt: value.receivedAt,
  });
}

function cloneEntityTombstone(value: EntityTombstone): EntityTombstone {
  return clonePlainObject({
    entityId: value.entityId,
    entityKind: value.entityKind,
    retiredAt: value.retiredAt,
    ...(value.reasonRef !== undefined ? { reasonRef: value.reasonRef } : {}),
  });
}

function cloneHeartbeatEntry(value: HeartbeatEntry): HeartbeatEntry {
  return clonePlainObject({
    agentId: value.agentId,
    sequenceNo: value.sequenceNo,
    emittedAt: value.emittedAt,
    turnCount: value.turnCount,
    lastAction: value.lastAction,
  });
}

function withDefaultNamespace(
  namespaces: ReadonlyMap<NamespaceId, CollaborationNamespace> | undefined,
): Map<NamespaceId, CollaborationNamespace> {
  const next = new Map(namespaces ?? []);
  if (!next.has(DEFAULT_NAMESPACE.namespaceId)) {
    next.set(DEFAULT_NAMESPACE.namespaceId, DEFAULT_NAMESPACE);
  }
  return next;
}

function freezeSnapshot(init: CollaborationSnapshotInit): CollaborationSnapshot {
  return clonePlainObject({
    snapshotRef: init.snapshotRef,
    epochId: init.epochId,
    participants: cloneReadonlyMap(init.participants ?? new Map(), cloneParticipant),
    artifacts: cloneReadonlyMap(init.artifacts ?? new Map(), cloneWorkArtifact),
    links: cloneReadonlyMap(init.links ?? new Map(), cloneCollaborationLink),
    sessions: cloneReadonlyMap(init.sessions ?? new Map(), cloneCommunicationSession),
    capabilities: cloneReadonlyMap(init.capabilities ?? new Map(), cloneScopedCapability),
    policyContext: clonePolicyContext(init.policyContext ?? defaultPolicyContext),
    auditTail: cloneReadonlyArray(init.auditTail ?? [], cloneObservationEntry),
    retiredEntities: cloneReadonlyArray(init.retiredEntities ?? [], cloneEntityTombstone),
    heartbeatLog: cloneReadonlyArray(init.heartbeatLog ?? [], cloneHeartbeatEntry),
    namespaces: cloneReadonlyMap(withDefaultNamespace(init.namespaces), cloneNamespace),
    transcripts: cloneReadonlyMap(init.transcripts ?? new Map(), cloneTranscript),
    transcriptAccessRequests: cloneReadonlyMap(
      init.transcriptAccessRequests ?? new Map(),
      cloneTranscriptAccessRequest,
    ),
  });
}

export function collaborationSnapshot(init: CollaborationSnapshotInit): CollaborationSnapshot {
  return freezeSnapshot(init);
}

/**
 * Append an external observation to auditTail without mutating the collaboration graph.
 * Discipline from diagram 01B §0: ObservationEntry ≠ CoordinationChange.
 */
export function appendObservation(
  snapshot: CollaborationSnapshot,
  entry: Omit<ObservationEntry, "sequenceNo">,
): CollaborationSnapshot {
  const sequenceNo = nextSequenceNo(snapshot.auditTail);
  const fullEntry: ObservationEntry = { ...entry, sequenceNo };
  return freezeSnapshot({
    ...snapshot,
    auditTail: appendToObservationStream(snapshot.auditTail, fullEntry),
  });
}

export function withParticipant(
  snapshot: CollaborationSnapshot,
  participant: Participant,
): CollaborationSnapshot {
  const participants = new Map(snapshot.participants);
  participants.set(participant.actorId, participant);
  return freezeSnapshot({ ...snapshot, participants });
}

export function withArtifact(
  snapshot: CollaborationSnapshot,
  artifact: WorkArtifact,
): CollaborationSnapshot {
  const artifacts = new Map(snapshot.artifacts);
  artifacts.set(artifact.artifactId, artifact);
  return freezeSnapshot({ ...snapshot, artifacts });
}

export function withLink(
  snapshot: CollaborationSnapshot,
  link: CollaborationLink,
): CollaborationSnapshot {
  const links = new Map(snapshot.links);
  links.set(link.linkId, link);
  return freezeSnapshot({ ...snapshot, links });
}

export function withSession(
  snapshot: CollaborationSnapshot,
  session: CommunicationSession,
): CollaborationSnapshot {
  const sessions = new Map(snapshot.sessions);
  sessions.set(session.sessionId, session);
  return freezeSnapshot({ ...snapshot, sessions });
}

export function withCapability(
  snapshot: CollaborationSnapshot,
  capability: ScopedCapability,
): CollaborationSnapshot {
  const capabilities = new Map(snapshot.capabilities);
  capabilities.set(capability.capabilityId, capability);
  return freezeSnapshot({ ...snapshot, capabilities });
}

export function withPolicyContext(
  snapshot: CollaborationSnapshot,
  policyContext: PolicyContext,
): CollaborationSnapshot {
  return freezeSnapshot({ ...snapshot, policyContext: clonePolicyContext(policyContext) });
}

export function withRetiredEntity(
  snapshot: CollaborationSnapshot,
  tombstone: EntityTombstone,
): CollaborationSnapshot {
  return freezeSnapshot({
    ...snapshot,
    retiredEntities: [...snapshot.retiredEntities, tombstone],
  });
}

/** Replace snapshot ref (after commit produces a new persisted snapshot). */
export function withSnapshotRef(
  snapshot: CollaborationSnapshot,
  snapshotRef: SnapshotRef,
): CollaborationSnapshot {
  return freezeSnapshot({ ...snapshot, snapshotRef });
}

/** Append a heartbeat entry to the snapshot's heartbeatLog. */
export function appendHeartbeat(
  snapshot: CollaborationSnapshot,
  entry: HeartbeatEntry,
): CollaborationSnapshot {
  return freezeSnapshot({
    ...snapshot,
    heartbeatLog: [...snapshot.heartbeatLog, entry],
  });
}

export function withNamespace(
  snapshot: CollaborationSnapshot,
  namespace: CollaborationNamespace,
): CollaborationSnapshot {
  const namespaces = new Map(snapshot.namespaces);
  namespaces.set(namespace.namespaceId, namespace);
  return freezeSnapshot({ ...snapshot, namespaces });
}

export function withTranscript(
  snapshot: CollaborationSnapshot,
  transcript: ParticipantTranscript,
): CollaborationSnapshot {
  const transcripts = new Map(snapshot.transcripts);
  transcripts.set(transcript.actorId, transcript);
  return freezeSnapshot({ ...snapshot, transcripts });
}

export function withTranscriptAccessRequest(
  snapshot: CollaborationSnapshot,
  request: TranscriptAccessRequest,
): CollaborationSnapshot {
  const transcriptAccessRequests = new Map(snapshot.transcriptAccessRequests);
  transcriptAccessRequests.set(request.requestId, request);
  return freezeSnapshot({ ...snapshot, transcriptAccessRequests });
}
