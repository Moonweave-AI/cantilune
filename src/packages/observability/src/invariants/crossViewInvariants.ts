import { structureStepFromChange } from "../projection/lenses/structureLens.js";
import { sliceHasProjectionActivity } from "../spine/foldFourViews.js";
import { type FourViewBundle } from "../index/fourViewBundle.js";
import { type ObservationWorld } from "../world/observationWorld.js";
import { readOnlyViolation, type ReadOnlyViolation } from "../foundation/readOnlyViolation.js";
import {
  filterLinksByKind,
  isDependencyLinkKind,
  isStructuralLinkKind,
} from "../projection/linkFilters.js";
import { type ScopedCapability } from "@cantilune/core";
import { eventTagKey } from "../foundation/eventTag.js";

export interface InvariantResult {
  readonly ok: true;
}

export interface InvariantFailure {
  readonly ok: false;
  readonly violations: readonly ReadOnlyViolation[];
}

export type CrossViewValidation = InvariantResult | InvariantFailure;

const FORBIDDEN_SCHEDULING_KEYS = new Set([
  "footprint",
  "effectiveFootprint",
  "requestedIsolationScope",
]);

function linkIds(links: readonly { readonly linkId: string }[]): string[] {
  return links.map((link) => link.linkId).sort((a, b) => a.localeCompare(b));
}

function setsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function indexTagKeys(bundle: FourViewBundle): string[] {
  return bundle.dependency.byEvent
    .tags()
    .map(eventTagKey)
    .sort((a, b) => a.localeCompare(b));
}

function spineTagKeys(bundle: FourViewBundle): string[] {
  return bundle.spine.events
    .map((event) => eventTagKey(event.eventTag))
    .sort((a, b) => a.localeCompare(b));
}

function capabilitiesMatchSnapshot(
  snapshotCaps: ReadonlyMap<string, ScopedCapability>,
  viewCaps: readonly ScopedCapability[],
): boolean {
  if (snapshotCaps.size !== viewCaps.length) {
    return false;
  }
  for (const capability of viewCaps) {
    const snapshotCap = snapshotCaps.get(capability.capabilityId);
    if (snapshotCap === undefined || JSON.stringify(snapshotCap) !== JSON.stringify(capability)) {
      return false;
    }
  }
  return true;
}

function collectSchedulingFieldViolations(
  value: unknown,
  path: string,
  violations: ReadOnlyViolation[],
  seen: WeakSet<object>,
): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      collectSchedulingFieldViolations(value[index], `${path}[${index}]`, violations, seen);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SCHEDULING_KEYS.has(key)) {
      violations.push(
        readOnlyViolation(
          "cross_view_mismatch",
          `forbidden scheduling field ${key} at ${path}`,
          "E7_no_scheduling_fields",
        ),
      );
    }
    collectSchedulingFieldViolations(child, `${path}.${key}`, violations, seen);
  }
}

function eventEvidenceOk(
  bundle: FourViewBundle,
  eventTag: (typeof bundle.spine.events)[0]["eventTag"],
): boolean {
  if (bundle.evidence === undefined) {
    return true;
  }
  const eventEvidence = bundle.evidence.byEvent.get(eventTag);
  if (eventEvidence === undefined) {
    return false;
  }
  return (
    eventEvidence.dependency.rederivedDeltaMatches &&
    eventEvidence.resource.rederivedDeltaMatches &&
    eventEvidence.communication.rederivedDeltaMatches &&
    eventEvidence.structure.rederivedDeltaMatches
  );
}

function collectSpineEventViolations(
  bundle: FourViewBundle,
  violations: ReadOnlyViolation[],
): void {
  for (const event of bundle.spine.events) {
    const tag = event.eventTag;
    const dep = bundle.dependency.byEvent.get(tag);
    const res = bundle.resource.byEvent.get(tag);
    const comm = bundle.communication.byEvent.get(tag);
    const str = bundle.structure.byEvent.get(tag);
    if (dep === undefined || res === undefined || comm === undefined || str === undefined) {
      violations.push(
        readOnlyViolation(
          "cross_view_mismatch",
          `missing projection slice for event ${String(event.eventTag.changeId)}`,
          "E1_event_coverage",
        ),
      );
      continue;
    }
    if (
      !sliceHasProjectionActivity({
        eventTag: event.eventTag,
        dependency: dep,
        resource: res,
        communication: comm,
        structure: str,
      })
    ) {
      violations.push(
        readOnlyViolation(
          "cross_view_mismatch",
          `event ${String(event.eventTag.changeId)} has empty projection activity`,
          "E1_event_coverage",
        ),
      );
    }
    if (bundle.evidence !== undefined && !eventEvidenceOk(bundle, tag)) {
      violations.push(
        readOnlyViolation(
          "cross_view_mismatch",
          `read-model evidence mismatch for event ${String(event.eventTag.changeId)}`,
          "O6_evidence_matches",
        ),
      );
    }
  }
}

function collectStructureStepViolations(
  bundle: FourViewBundle,
  violations: ReadOnlyViolation[],
): void {
  for (const event of bundle.spine.events) {
    const structureDelta = bundle.structure.byEvent.get(event.eventTag);
    if (structureDelta === undefined) {
      continue;
    }
    const expected = structureStepFromChange(event.change);
    const actual = structureDelta.step;
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      violations.push(
        readOnlyViolation(
          "cross_view_mismatch",
          `structure step mismatch for ${String(event.eventTag.changeId)}`,
          "E5_structure_reuses_derive",
        ),
      );
    }
  }
}

export function validateCrossViewInvariants(
  bundle: FourViewBundle,
  world: ObservationWorld,
): CrossViewValidation {
  const violations: ReadOnlyViolation[] = [];

  if (!setsEqual(spineTagKeys(bundle), indexTagKeys(bundle))) {
    violations.push(
      readOnlyViolation(
        "cross_view_mismatch",
        "spine EventTag set !== byEvent index tag set",
        "E1_index_spine_equality",
      ),
    );
  }

  collectSpineEventViolations(bundle, violations);

  const snapshotSessionIds = [...world.snapshot.sessions.keys()].sort((a, b) => a.localeCompare(b));
  const viewSessionIds = bundle.communication.sessions
    .map((session) => session.sessionId)
    .sort((a, b) => a.localeCompare(b));
  if (!setsEqual(viewSessionIds, snapshotSessionIds)) {
    violations.push(
      readOnlyViolation(
        "cross_view_mismatch",
        "communication view sessions !== terminal snapshot sessions",
        "E2_session_bijection",
      ),
    );
  }

  if (!capabilitiesMatchSnapshot(world.snapshot.capabilities, bundle.resource.capabilities)) {
    violations.push(
      readOnlyViolation(
        "cross_view_mismatch",
        "resource view capabilities do not match terminal snapshot",
        "E3_capability_matches_snapshot",
      ),
    );
  }

  const snapshotDependencyLinks = filterLinksByKind(world.snapshot.links, isDependencyLinkKind);
  if (!setsEqual(linkIds(bundle.dependency.links), linkIds(snapshotDependencyLinks))) {
    violations.push(
      readOnlyViolation(
        "cross_view_mismatch",
        "dependency view link set !== terminal snapshot dependency links",
        "E4_dependency_link_equality",
      ),
    );
  }

  const snapshotStructuralLinks = filterLinksByKind(world.snapshot.links, isStructuralLinkKind);
  if (!setsEqual(linkIds(bundle.structure.structuralLinks), linkIds(snapshotStructuralLinks))) {
    violations.push(
      readOnlyViolation(
        "cross_view_mismatch",
        "structure view link set !== terminal snapshot structural links",
        "E4_structural_link_equality",
      ),
    );
  }

  collectStructureStepViolations(bundle, violations);

  if (bundle.evidence !== undefined && !bundle.evidence.terminalFieldsMatchSnapshot) {
    violations.push(
      readOnlyViolation(
        "cross_view_mismatch",
        "read-model evidence reports terminal/snapshot mismatch",
        "O6_terminal_fields_match_snapshot",
      ),
    );
  }

  collectSchedulingFieldViolations(bundle, "bundle", violations, new WeakSet());

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}

export const CrossViewInvariants = {
  validate: validateCrossViewInvariants,
};
