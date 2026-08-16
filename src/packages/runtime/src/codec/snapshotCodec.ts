import type { RuntimeViolation } from "../foundation/errors.js";
import { parseSnapshotWire, type CodecParseResult } from "./wireValidation.js";
import {
  collaborationSnapshot,
  type CollaborationSnapshot,
  type EntityTombstone,
  type ObservationEntry,
  type Participant,
  type PolicyContext,
  type WorkArtifact,
  type CollaborationLink,
  type CommunicationSession,
  type ScopedCapability,
  type EpochId,
  type HeartbeatLog,
  type SnapshotRef,
  type CollaborationNamespace,
  type ParticipantTranscript,
  type TranscriptAccessRequest,
  type ActorId,
  type TranscriptAccessRequestId,
} from "@cantilune/core";

export interface SnapshotWireDto {
  readonly snapshotRef: string;
  readonly epochId: string;
  readonly participants: readonly Participant[];
  readonly artifacts: readonly WorkArtifact[];
  readonly links: readonly CollaborationLink[];
  readonly sessions: readonly CommunicationSession[];
  readonly capabilities: readonly ScopedCapability[];
  readonly policyContext: PolicyContext;
  readonly auditTail: readonly ObservationEntry[];
  readonly retiredEntities: readonly EntityTombstone[];
  /**
   * Optional so bundles written before the field existed still load. It was
   * missing entirely, and since every file-backed read reloads through this
   * codec, committed heartbeats were erased almost immediately and liveness
   * detection saw every agent as silent.
   */
  readonly heartbeatLog?: HeartbeatLog;
  readonly namespaces?: readonly CollaborationNamespace[];
  readonly transcripts?: readonly ParticipantTranscript[];
  readonly transcriptAccessRequests?: readonly TranscriptAccessRequest[];
}

export function encodeSnapshot(snapshot: CollaborationSnapshot): SnapshotWireDto {
  return {
    snapshotRef: snapshot.snapshotRef,
    epochId: snapshot.epochId,
    participants: [...snapshot.participants.values()],
    artifacts: [...snapshot.artifacts.values()],
    links: [...snapshot.links.values()],
    sessions: [...snapshot.sessions.values()],
    capabilities: [...snapshot.capabilities.values()],
    policyContext: snapshot.policyContext,
    auditTail: [...snapshot.auditTail],
    retiredEntities: [...snapshot.retiredEntities],
    heartbeatLog: [...snapshot.heartbeatLog],
    namespaces: [...snapshot.namespaces.values()],
    transcripts: [...snapshot.transcripts.values()],
    transcriptAccessRequests: [...snapshot.transcriptAccessRequests.values()],
  };
}

export function decodeSnapshot(dto: SnapshotWireDto): CollaborationSnapshot {
  return collaborationSnapshot({
    snapshotRef: dto.snapshotRef as SnapshotRef,
    epochId: dto.epochId as EpochId,
    participants: new Map(
      dto.participants.map((participant) => [participant.actorId, participant]),
    ),
    artifacts: new Map(dto.artifacts.map((artifact) => [artifact.artifactId, artifact])),
    links: new Map(dto.links.map((link) => [link.linkId, link])),
    sessions: new Map(dto.sessions.map((session) => [session.sessionId, session])),
    capabilities: new Map(
      dto.capabilities.map((capability) => [capability.capabilityId, capability]),
    ),
    policyContext: dto.policyContext,
    auditTail: dto.auditTail,
    retiredEntities: dto.retiredEntities,
    heartbeatLog: dto.heartbeatLog ?? [],
    namespaces: new Map(
      (dto.namespaces ?? []).map((namespace) => [namespace.namespaceId, namespace]),
    ),
    transcripts: new Map(
      (dto.transcripts ?? []).map((transcript) => [transcript.actorId as ActorId, transcript]),
    ),
    transcriptAccessRequests: new Map(
      (dto.transcriptAccessRequests ?? []).map((request) => [
        request.requestId as TranscriptAccessRequestId,
        request,
      ]),
    ),
  });
}

export function decodeSnapshotFromUnknown(
  input: unknown,
): CollaborationSnapshot | RuntimeViolation {
  const parsed = parseSnapshotWire(input);
  if (!parsed.ok) {
    return parsed.violation;
  }
  return decodeSnapshot(parsed.value);
}

export function parseSnapshotWireDto(input: unknown): CodecParseResult<SnapshotWireDto> {
  return parseSnapshotWire(input);
}
