import {
  collaborationSnapshot,
  type CollaborationLink,
  type CollaborationSnapshot,
  type CommunicationSession,
  type CoordinationChange,
  type ScopedCapability,
} from "@cantilune/core";
import { createEventTagIndex, type EventTagIndex } from "./eventTagIndex.js";
import { type FourViewBundle } from "../index/fourViewBundle.js";
import {
  type EventReadModelEvidence,
  type ReadModelDerivationEvidence,
} from "../certificate/readModelDerivationEvidence.js";
import { type SourceEvent } from "../world/eventSpine.js";

/** Deep-clone snapshot via core constructor — observability boundary isolation. */
export function cloneSnapshotForObservation(
  snapshot: CollaborationSnapshot,
): CollaborationSnapshot {
  return collaborationSnapshot({
    snapshotRef: snapshot.snapshotRef,
    epochId: snapshot.epochId,
    participants: snapshot.participants,
    artifacts: snapshot.artifacts,
    links: snapshot.links,
    sessions: snapshot.sessions,
    capabilities: snapshot.capabilities,
    policyContext: snapshot.policyContext,
    auditTail: snapshot.auditTail,
    retiredEntities: snapshot.retiredEntities,
  });
}

function cloneValue<T>(value: T): T {
  type CloneGlobal = typeof globalThis & { structuredClone: <U>(input: U) => U };
  return (globalThis as CloneGlobal).structuredClone(value);
}

function cloneLink(link: CollaborationLink): CollaborationLink {
  return { ...link };
}

function cloneCapability(capability: ScopedCapability): ScopedCapability {
  return { ...capability };
}

function cloneSession(session: CommunicationSession): CommunicationSession {
  return { ...session };
}

function cloneChange(change: CoordinationChange): CoordinationChange {
  return {
    ...change,
    matchBindings: [...change.matchBindings],
    targets: [...change.targets],
    createdSessionRefs: [...change.createdSessionRefs],
    involved: [...change.involved],
  };
}

function cloneEventTagIndex<T extends object>(index: EventTagIndex<T>): EventTagIndex<T> {
  return createEventTagIndex(
    [...index.entries()].map(([tag, value]) => ({
      tag: { ...tag },
      value: cloneValue(value),
    })),
  );
}

function cloneSourceEvent(event: SourceEvent): SourceEvent {
  return {
    eventTag: { ...event.eventTag },
    change: cloneChange(event.change),
  };
}

function cloneReadModelEvidence(
  evidence: ReadModelDerivationEvidence,
): ReadModelDerivationEvidence {
  return {
    byEvent: cloneEventTagIndex<EventReadModelEvidence>(evidence.byEvent),
    terminalFieldsMatchSnapshot: evidence.terminalFieldsMatchSnapshot,
  };
}

/** Freeze bundle outputs so consumers cannot mutate authoritative store objects. */
export function freezeFourViewBundle(bundle: FourViewBundle): FourViewBundle {
  return Object.freeze({
    spine: Object.freeze({
      events: Object.freeze(bundle.spine.events.map(cloneSourceEvent)),
    }),
    dependency: Object.freeze({
      links: Object.freeze(bundle.dependency.links.map(cloneLink)),
      byEvent: cloneEventTagIndex(bundle.dependency.byEvent),
    }),
    resource: Object.freeze({
      capabilities: Object.freeze(bundle.resource.capabilities.map(cloneCapability)),
      byEvent: cloneEventTagIndex(bundle.resource.byEvent),
    }),
    communication: Object.freeze({
      sessions: Object.freeze(bundle.communication.sessions.map(cloneSession)),
      byEvent: cloneEventTagIndex(bundle.communication.byEvent),
    }),
    structure: Object.freeze({
      composition: cloneValue(bundle.structure.composition),
      structuralLinks: Object.freeze(bundle.structure.structuralLinks.map(cloneLink)),
      byEvent: cloneEventTagIndex(bundle.structure.byEvent),
    }),
    ...(bundle.diagnostic !== undefined ? { diagnostic: cloneValue(bundle.diagnostic) } : {}),
    ...(bundle.evidence !== undefined ? { evidence: cloneReadModelEvidence(bundle.evidence) } : {}),
  });
}

export function sortLinksById<T extends { readonly linkId: string }>(links: readonly T[]): T[] {
  return [...links].sort((left, right) => left.linkId.localeCompare(right.linkId));
}

export function sortById<T, K extends keyof T>(items: readonly T[], key: K): T[] {
  const toStr = (v: T[K]): string => {
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return "";
  };
  return [...items].sort((left, right) => toStr(left[key]).localeCompare(toStr(right[key])));
}
