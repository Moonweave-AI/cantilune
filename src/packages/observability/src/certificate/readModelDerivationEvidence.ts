import { type EventTag } from "../foundation/eventTag.js";
import { type EventTagIndex, createEventTagIndex } from "../foundation/eventTagIndex.js";
import { type FourViewBundle } from "../index/fourViewBundle.js";
import { type SnapshotResolver, resolveSnapshotStrict } from "../input/assembleWorld.js";
import { interpretCommunicationDelta } from "../projection/lenses/communicationLens.js";
import { interpretDependencyDelta } from "../projection/lenses/dependencyLens.js";
import { interpretResourceDelta } from "../projection/lenses/resourceLens.js";
import { interpretStructureDelta } from "../projection/lenses/structureLens.js";
import {
  filterLinksByKind,
  isDependencyLinkKind,
  isStructuralLinkKind,
} from "../projection/linkFilters.js";
import { type SourceEvent } from "../world/eventSpine.js";
import { type ObservationWorld } from "../world/observationWorld.js";

/** Engineering self-check for one read angle at one event (not formal ProjectionCertificate). */
export interface AngleReadModelEvidence {
  readonly snapshotsResolved: boolean;
  readonly rederivedDeltaMatches: boolean;
}

/** Per-event engineering evidence across four read angles. */
export interface EventReadModelEvidence {
  readonly eventTag: EventTag;
  readonly dependency: AngleReadModelEvidence;
  readonly resource: AngleReadModelEvidence;
  readonly communication: AngleReadModelEvidence;
  readonly structure: AngleReadModelEvidence;
}

/** Bundle-level read-model derivation evidence keyed by ChangeId. */
export interface ReadModelDerivationEvidence {
  readonly byEvent: EventTagIndex<EventReadModelEvidence>;
  readonly terminalFieldsMatchSnapshot: boolean;
}

function deltasMatch<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function angleEvidence<T>(
  snapshotsResolved: boolean,
  stored: T,
  expected: T,
): AngleReadModelEvidence {
  return {
    snapshotsResolved,
    rederivedDeltaMatches: snapshotsResolved && deltasMatch(stored, expected),
  };
}

function unresolvedEventEvidence(eventTag: EventTag): EventReadModelEvidence {
  return {
    eventTag,
    dependency: { snapshotsResolved: false, rederivedDeltaMatches: false },
    resource: { snapshotsResolved: false, rederivedDeltaMatches: false },
    communication: { snapshotsResolved: false, rederivedDeltaMatches: false },
    structure: { snapshotsResolved: false, rederivedDeltaMatches: false },
  };
}

function resolveEventSnapshots(
  resolver: SnapshotResolver,
  change: SourceEvent["change"],
):
  | {
      readonly before: ReturnType<typeof resolveSnapshotStrict>;
      readonly after: ReturnType<typeof resolveSnapshotStrict>;
    }
  | undefined {
  try {
    return {
      before: resolveSnapshotStrict(resolver, change.beforeRef, "beforeRef"),
      after: resolveSnapshotStrict(resolver, change.afterRef, "afterRef"),
    };
  } catch {
    return undefined;
  }
}

function buildEventEvidence(
  bundle: FourViewBundle,
  event: SourceEvent,
  resolver: SnapshotResolver,
): EventReadModelEvidence | undefined {
  const snapshots = resolveEventSnapshots(resolver, event.change);
  if (snapshots === undefined) {
    return unresolvedEventEvidence(event.eventTag);
  }
  const { before, after } = snapshots;

  const storedDependency = bundle.dependency.byEvent.get(event.eventTag);
  const storedResource = bundle.resource.byEvent.get(event.eventTag);
  const storedCommunication = bundle.communication.byEvent.get(event.eventTag);
  const storedStructure = bundle.structure.byEvent.get(event.eventTag);
  if (
    storedDependency === undefined ||
    storedResource === undefined ||
    storedCommunication === undefined ||
    storedStructure === undefined
  ) {
    return undefined;
  }

  return {
    eventTag: event.eventTag,
    dependency: angleEvidence(
      true,
      storedDependency,
      interpretDependencyDelta(event.eventTag, before, after),
    ),
    resource: angleEvidence(
      true,
      storedResource,
      interpretResourceDelta(event.eventTag, before, after),
    ),
    communication: angleEvidence(
      true,
      storedCommunication,
      interpretCommunicationDelta(event.eventTag, before, after),
    ),
    structure: angleEvidence(
      true,
      storedStructure,
      interpretStructureDelta(event.eventTag, before, after, event.change),
    ),
  };
}

function linkSetsMatch(
  viewLinks: readonly { readonly linkId: string }[],
  snapshotLinks: readonly { readonly linkId: string }[],
): boolean {
  if (viewLinks.length !== snapshotLinks.length) {
    return false;
  }
  const viewIds = viewLinks.map((link) => link.linkId).sort((a, b) => a.localeCompare(b));
  const snapshotIds = snapshotLinks.map((link) => link.linkId).sort((a, b) => a.localeCompare(b));
  return viewIds.every((id, index) => id === snapshotIds[index]);
}

function terminalCapabilitiesMatch(bundle: FourViewBundle, world: ObservationWorld): boolean {
  if (bundle.resource.capabilities.length !== world.snapshot.capabilities.size) {
    return false;
  }
  for (const capability of bundle.resource.capabilities) {
    const snapshotCap = world.snapshot.capabilities.get(capability.capabilityId);
    if (snapshotCap === undefined || JSON.stringify(snapshotCap) !== JSON.stringify(capability)) {
      return false;
    }
  }
  return true;
}

function terminalSessionsMatch(bundle: FourViewBundle, world: ObservationWorld): boolean {
  if (bundle.communication.sessions.length !== world.snapshot.sessions.size) {
    return false;
  }
  for (const session of bundle.communication.sessions) {
    const snapshotSession = world.snapshot.sessions.get(session.sessionId);
    if (
      snapshotSession === undefined ||
      JSON.stringify(snapshotSession) !== JSON.stringify(session)
    ) {
      return false;
    }
  }
  return true;
}

function terminalViewLinksMatch(
  bundle: FourViewBundle,
  world: ObservationWorld,
  kind: "dependency" | "structural",
): boolean {
  const isKind = kind === "dependency" ? isDependencyLinkKind : isStructuralLinkKind;
  const viewLinks =
    kind === "dependency" ? bundle.dependency.links : bundle.structure.structuralLinks;
  const snapshotLinks = filterLinksByKind(world.snapshot.links, isKind);
  if (!linkSetsMatch(viewLinks, snapshotLinks)) {
    return false;
  }
  for (const link of viewLinks) {
    const snapshotLink = world.snapshot.links.get(link.linkId);
    if (
      snapshotLink === undefined ||
      !isKind(link.kind) ||
      JSON.stringify(snapshotLink) !== JSON.stringify(link)
    ) {
      return false;
    }
  }
  return true;
}

function terminalFieldsMatchSnapshot(bundle: FourViewBundle, world: ObservationWorld): boolean {
  return (
    terminalCapabilitiesMatch(bundle, world) &&
    terminalSessionsMatch(bundle, world) &&
    terminalViewLinksMatch(bundle, world, "dependency") &&
    terminalViewLinksMatch(bundle, world, "structural")
  );
}

export function buildReadModelDerivationEvidence(
  bundle: FourViewBundle,
  world: ObservationWorld,
  resolver: SnapshotResolver,
): ReadModelDerivationEvidence {
  const entries: { tag: EventTag; value: EventReadModelEvidence }[] = [];
  for (const event of bundle.spine.events) {
    const evidence = buildEventEvidence(bundle, event, resolver);
    if (evidence !== undefined) {
      entries.push({ tag: event.eventTag, value: evidence });
    }
  }

  return {
    byEvent: createEventTagIndex(entries),
    terminalFieldsMatchSnapshot: terminalFieldsMatchSnapshot(bundle, world),
  };
}

export const ReadModelDerivationEvidenceBuilder = {
  build: buildReadModelDerivationEvidence,
};

/** @deprecated Use {@link ReadModelDerivationEvidence} — not a formal ProjectionCertificate. */
export type FourProjectionCertificateMeta = ReadModelDerivationEvidence;

/** @deprecated Use {@link buildReadModelDerivationEvidence}. */
export const buildProjectionCertificateMeta = buildReadModelDerivationEvidence;

/** @deprecated Use {@link ReadModelDerivationEvidenceBuilder}. */
export const ProjectionCertificateMeta = ReadModelDerivationEvidenceBuilder;
