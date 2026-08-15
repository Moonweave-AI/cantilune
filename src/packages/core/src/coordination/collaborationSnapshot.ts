import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  EpochId,
  LinkId,
  SessionId,
} from "../primitives/ids.js";
import type { SnapshotRef } from "../primitives/refs.js";
import type { CollaborationLink, LinkEndpoint } from "../nodes/collaborationLink.js";
import type { CommunicationSession } from "../nodes/communicationSession.js";
import type { EntityTombstone } from "../nodes/entityTombstone.js";
import type { ObservationEntry } from "../nodes/observationEntry.js";
import type { ActorRef, Participant } from "../nodes/participant.js";
import { emptyPolicyContext as defaultPolicyContext } from "../nodes/policyContext.js";
import type { ApprovalState, PolicyContext, RetryState } from "../nodes/policyContext.js";
import type { CapabilityScope, ScopedCapability } from "../nodes/scopedCapability.js";
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
}

function cloneActorRef(ref: ActorRef): ActorRef {
  return clonePlainObject({ actorId: ref.actorId, kind: ref.kind });
}

function cloneParticipant(value: Participant): Participant {
  const base = clonePlainObject({ actorId: value.actorId, kind: value.kind, status: value.status });
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
  return clonePlainObject({ kind: value.kind, sessionId: value.sessionId });
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
