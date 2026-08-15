import {
  type CapabilityId,
  type CollaborationLink,
  type CommunicationSession,
  type DerivedDiagnosticView,
  type LinkId,
  type ScopedCapability,
  type SessionId,
} from "@cantilune/core";
import { type EventTag } from "../foundation/eventTag.js";

export interface DependencyDelta {
  readonly eventTag: EventTag;
  readonly addedLinks: readonly CollaborationLink[];
  readonly updatedLinks: readonly CollaborationLink[];
  readonly removedLinkIds: readonly LinkId[];
}

export interface ResourceDelta {
  readonly eventTag: EventTag;
  readonly updatedCapabilities: readonly ScopedCapability[];
  readonly removedCapabilityIds: readonly CapabilityId[];
}

export interface CommunicationDelta {
  readonly eventTag: EventTag;
  readonly openedSessions: readonly CommunicationSession[];
  readonly closedSessionIds: readonly SessionId[];
  readonly updatedSessions: readonly CommunicationSession[];
}

export interface StructureDelta {
  readonly eventTag: EventTag;
  readonly step: DerivedDiagnosticView;
  readonly structuralLinks: readonly CollaborationLink[];
  readonly updatedStructuralLinks: readonly CollaborationLink[];
  readonly removedStructuralLinkIds: readonly LinkId[];
}

export interface ProjectionSlice {
  readonly eventTag: EventTag;
  readonly dependency: DependencyDelta;
  readonly resource: ResourceDelta;
  readonly communication: CommunicationDelta;
  readonly structure: StructureDelta;
}

export function projectionSlice(parts: {
  readonly dependency: DependencyDelta;
  readonly resource: ResourceDelta;
  readonly communication: CommunicationDelta;
  readonly structure: StructureDelta;
}): ProjectionSlice {
  return {
    eventTag: parts.dependency.eventTag,
    dependency: parts.dependency,
    resource: parts.resource,
    communication: parts.communication,
    structure: parts.structure,
  };
}
