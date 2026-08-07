import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  EpochId,
  LinkId,
  SessionId,
} from "../primitives/ids.js";
import type { SnapshotRef } from "../primitives/refs.js";
import type { CollaborationLink } from "../nodes/collaborationLink.js";
import type { CommunicationSession } from "../nodes/communicationSession.js";
import type { EntityTombstone } from "../nodes/entityTombstone.js";
import type { ObservationEntry } from "../nodes/observationEntry.js";
import type { Participant } from "../nodes/participant.js";
import { emptyPolicyContext as defaultPolicyContext } from "../nodes/policyContext.js";
import type { PolicyContext } from "../nodes/policyContext.js";
import type { ScopedCapability } from "../nodes/scopedCapability.js";
import type { WorkArtifact } from "../nodes/workArtifact.js";
import { appendToObservationStream, nextSequenceNo } from "./observationStream.js";

/** Complete collaboration world at one instant (Config σ). */
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
}

export function collaborationSnapshot(init: CollaborationSnapshotInit): CollaborationSnapshot {
  return {
    snapshotRef: init.snapshotRef,
    epochId: init.epochId,
    participants: init.participants ?? new Map(),
    artifacts: init.artifacts ?? new Map(),
    links: init.links ?? new Map(),
    sessions: init.sessions ?? new Map(),
    capabilities: init.capabilities ?? new Map(),
    policyContext: init.policyContext ?? defaultPolicyContext,
    auditTail: init.auditTail ?? [],
    retiredEntities: init.retiredEntities ?? [],
  };
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
  return {
    ...snapshot,
    auditTail: appendToObservationStream(snapshot.auditTail, fullEntry),
  };
}

export function withParticipant(
  snapshot: CollaborationSnapshot,
  participant: Participant,
): CollaborationSnapshot {
  const participants = new Map(snapshot.participants);
  participants.set(participant.actorId, participant);
  return { ...snapshot, participants };
}

export function withArtifact(
  snapshot: CollaborationSnapshot,
  artifact: WorkArtifact,
): CollaborationSnapshot {
  const artifacts = new Map(snapshot.artifacts);
  artifacts.set(artifact.artifactId, artifact);
  return { ...snapshot, artifacts };
}

export function withLink(snapshot: CollaborationSnapshot, link: CollaborationLink): CollaborationSnapshot {
  const links = new Map(snapshot.links);
  links.set(link.linkId, link);
  return { ...snapshot, links };
}

export function withSession(
  snapshot: CollaborationSnapshot,
  session: CommunicationSession,
): CollaborationSnapshot {
  const sessions = new Map(snapshot.sessions);
  sessions.set(session.sessionId, session);
  return { ...snapshot, sessions };
}

export function withCapability(
  snapshot: CollaborationSnapshot,
  capability: ScopedCapability,
): CollaborationSnapshot {
  const capabilities = new Map(snapshot.capabilities);
  capabilities.set(capability.capabilityId, capability);
  return { ...snapshot, capabilities };
}

export function withPolicyContext(
  snapshot: CollaborationSnapshot,
  policyContext: PolicyContext,
): CollaborationSnapshot {
  return { ...snapshot, policyContext };
}

export function withRetiredEntity(
  snapshot: CollaborationSnapshot,
  tombstone: EntityTombstone,
): CollaborationSnapshot {
  return { ...snapshot, retiredEntities: [...snapshot.retiredEntities, tombstone] };
}

/** Replace snapshot ref (after commit produces a new persisted snapshot). */
export function withSnapshotRef(
  snapshot: CollaborationSnapshot,
  snapshotRef: SnapshotRef,
): CollaborationSnapshot {
  return { ...snapshot, snapshotRef };
}
