import { describe, expect, it } from "vitest";
import { validateCrossViewInvariants } from "../../../src/invariants/crossViewInvariants.js";
import { createEventTagIndex } from "../../../src/foundation/eventTagIndex.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { storyActorIds, storyEntityIds, buildConfigT0 } from "@cantilune/test-fixtures";
import {
  coordinationIntent,
  matchBinding,
  operationTypeId,
  actorRef,
  collaborationLink,
  linkId,
  actorId,
  epochId,
  snapshotRef,
  collaborationSnapshot,
} from "@cantilune/core";
import { observeCommittedExplicit } from "../../support/scenario/observabilityHarness.js";
import { buildEventSpine } from "../../../src/world/eventSpine.js";
import { fourViewBundle } from "../../../src/index/fourViewBundle.js";
import { dependencyView } from "../../../src/projection/views/dependencyView.js";
import { resourceView } from "../../../src/projection/views/resourceView.js";
import { communicationView } from "../../../src/projection/views/communicationView.js";
import { structureView } from "../../../src/projection/views/structureView.js";
import { observationWorld } from "../../../src/world/observationWorld.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";
import {
  type CommunicationDelta,
  type DependencyDelta,
  type ResourceDelta,
  type StructureDelta,
} from "../../../src/spine/projectionSlice.js";
import { testArtifactContentRef } from "../../support/contentRefs.js";

async function buildDelegateClosure() {
  const deps = buildTestRuntime({
    snapshotRefs: ["snap-S1", "snap-S2", "snap-S3"],
    changeIds: ["chg-001", "chg-002"],
    sessionIds: [storyEntityIds.session],
    linkIds: ["link-waits-1", "link-nest-1"],
  });
  const introduce = deps.runtime.admit(
    coordinationIntent(
      actorRef(storyActorIds.planner, "agent"),
      operationTypeId("introduce_artifact"),
      [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("capability", storyEntityIds.writeLock),
      ],
      undefined,
      [testArtifactContentRef],
    ),
  );
  if (!introduce.ok) {
    throw new Error("introduce admit failed");
  }
  const introduceCommit = deps.runtime.commit(introduce.ticket);
  if (!("change" in introduceCommit)) {
    throw new Error("introduce commit failed");
  }
  const delegate = deps.runtime.admit(
    coordinationIntent(actorRef(storyActorIds.planner, "agent"), operationTypeId("delegate"), [
      matchBinding("task", storyEntityIds.task),
      matchBinding("from", storyActorIds.planner),
      matchBinding("to", storyActorIds.coder),
      matchBinding("capability", storyEntityIds.writeLock),
      matchBinding("participant", "reviewer-r" as typeof storyActorIds.planner),
    ]),
  );
  if (!delegate.ok) {
    throw new Error("delegate admit failed");
  }
  const delegateCommit = deps.runtime.commit(delegate.ticket);
  if (!("change" in delegateCommit)) {
    throw new Error("delegate commit failed");
  }
  return observeCommittedExplicit(deps, deps.t0.snapshotRef, {
    validateInvariants: false,
    attachEvidence: true,
  });
}

describe("validateCrossViewInvariants additional branches", () => {
  it("rejects spine/index tag set mismatch (E1_index_spine_equality)", async () => {
    const closure = await buildDelegateClosure();
    const eventTag = closure.bundle.spine.events[0]!.eventTag;
    const depByEvent = createEventTagIndex(
      [...closure.bundle.dependency.byEvent.entries()]
        .filter(([tag]) => tag.changeId !== eventTag.changeId)
        .map(([tag, value]) => ({ tag, value })),
    );
    const bad = {
      ...closure.bundle,
      dependency: { ...closure.bundle.dependency, byEvent: depByEvent },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E1_index_spine_equality")).toBe(true);
  });

  it("rejects empty projection activity (E1_event_coverage)", async () => {
    const closure = await buildDelegateClosure();
    const eventTag = closure.bundle.spine.events[0]!.eventTag;
    const emptySlice = {
      eventTag,
      addedLinks: [] as const,
      updatedLinks: [] as const,
      removedLinkIds: [] as const,
    };
    const emptyResource = {
      eventTag,
      updatedCapabilities: [] as const,
      removedCapabilityIds: [] as const,
    };
    const emptyComm = {
      eventTag,
      openedSessions: [] as const,
      closedSessionIds: [] as const,
      updatedSessions: [] as const,
    };
    const emptyStruct: StructureDelta = {
      eventTag,
      step: { kind: "box" },
      structuralLinks: [],
      updatedStructuralLinks: [],
      removedStructuralLinkIds: [],
    };
    const depByEvent = createEventTagIndex(
      [...closure.bundle.dependency.byEvent.entries()].map(([tag, value]) =>
        tag.changeId === eventTag.changeId ? { tag, value: emptySlice } : { tag, value },
      ),
    );
    const resByEvent = createEventTagIndex(
      [...closure.bundle.resource.byEvent.entries()].map(([tag, value]) =>
        tag.changeId === eventTag.changeId ? { tag, value: emptyResource } : { tag, value },
      ),
    );
    const commByEvent = createEventTagIndex(
      [...closure.bundle.communication.byEvent.entries()].map(([tag, value]) =>
        tag.changeId === eventTag.changeId ? { tag, value: emptyComm } : { tag, value },
      ),
    );
    const structByEvent = createEventTagIndex<StructureDelta>(
      [...closure.bundle.structure.byEvent.entries()].map(([tag, value]) =>
        tag.changeId === eventTag.changeId ? { tag, value: emptyStruct } : { tag, value },
      ),
    );
    const bad = {
      ...closure.bundle,
      dependency: { ...closure.bundle.dependency, byEvent: depByEvent },
      resource: { ...closure.bundle.resource, byEvent: resByEvent },
      communication: { ...closure.bundle.communication, byEvent: commByEvent },
      structure: { ...closure.bundle.structure, byEvent: structByEvent },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E1_event_coverage")).toBe(true);
  });

  it("rejects session bijection mismatch (E2)", async () => {
    const closure = await buildDelegateClosure();
    expect(closure.bundle.communication.sessions.length).toBeGreaterThan(0);
    const bad = {
      ...closure.bundle,
      communication: { ...closure.bundle.communication, sessions: [] },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E2_session_bijection")).toBe(true);
  });

  it("rejects structural link mismatch (E4_structural_link_equality)", () => {
    const snap = snapshotRef("snap-S1");
    const structLink = collaborationLink(
      linkId("link-nest-1"),
      "nested_in",
      { kind: "participant", actorId: actorId("a") },
      { kind: "participant", actorId: actorId("b") },
    );
    const worldSnap = collaborationSnapshot({
      snapshotRef: snap,
      epochId: epochId("1"),
      links: new Map([[structLink.linkId, structLink]]),
    });
    const emptyDep = createEventTagIndex<DependencyDelta>([]);
    const emptyRes = createEventTagIndex<ResourceDelta>([]);
    const emptyComm = createEventTagIndex<CommunicationDelta>([]);
    const emptyStruct = createEventTagIndex<StructureDelta>([]);
    const bundle = fourViewBundle({
      spine: buildEventSpine([]),
      dependency: dependencyView({ links: [], byEvent: emptyDep }),
      resource: resourceView({ capabilities: [], byEvent: emptyRes }),
      communication: communicationView({ sessions: [], byEvent: emptyComm }),
      structure: structureView({
        composition: { kind: "box" },
        structuralLinks: [],
        byEvent: emptyStruct,
      }),
    });
    const world = observationWorld({
      snapshotRef: snap,
      snapshot: worldSnap,
      validatedHistory: toValidatedHistory(),
      changes: [],
      sinceRef: snap,
    });
    const result = validateCrossViewInvariants(bundle, world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E4_structural_link_equality")).toBe(true);
  });

  it("rejects structure step mismatch (E5)", async () => {
    const closure = await buildDelegateClosure();
    const eventTag = closure.bundle.spine.events[0]!.eventTag;
    const structureDelta = closure.bundle.structure.byEvent.get(eventTag)!;
    const badStruct = {
      ...structureDelta,
      step: { kind: "parallel" as const, parts: [{ kind: "box" as const }] },
    };
    const structByEvent = createEventTagIndex([{ tag: eventTag, value: badStruct }]);
    const bad = {
      ...closure.bundle,
      structure: { ...closure.bundle.structure, byEvent: structByEvent },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E5_structure_reuses_derive")).toBe(true);
  });

  it("rejects evidence mismatch (O6_evidence_matches)", async () => {
    const closure = await buildDelegateClosure();
    const eventTag = closure.bundle.spine.events[0]!.eventTag;
    const eventEvidence = closure.bundle.evidence!.byEvent.get(eventTag)!;
    const badEvidence = {
      ...eventEvidence,
      dependency: { snapshotsResolved: true, rederivedDeltaMatches: false },
    };
    const byEvent = createEventTagIndex([{ tag: eventTag, value: badEvidence }]);
    const bad = {
      ...closure.bundle,
      evidence: { ...closure.bundle.evidence!, byEvent },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "O6_evidence_matches")).toBe(true);
  });

  it("rejects terminal evidence flag mismatch (O6_terminal_fields_match_snapshot)", async () => {
    const closure = await buildDelegateClosure();
    const bad = {
      ...closure.bundle,
      evidence: { ...closure.bundle.evidence!, terminalFieldsMatchSnapshot: false },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "O6_terminal_fields_match_snapshot")).toBe(
      true,
    );
  });

  it("rejects nested scheduling fields in arrays (E7)", async () => {
    const snapshot = buildConfigT0();
    const emptyDep = createEventTagIndex<DependencyDelta>([]);
    const emptyRes = createEventTagIndex<ResourceDelta>([]);
    const emptyComm = createEventTagIndex<CommunicationDelta>([]);
    const emptyStruct = createEventTagIndex<StructureDelta>([]);
    const bundle = fourViewBundle({
      spine: buildEventSpine([]),
      dependency: dependencyView({ links: [], byEvent: emptyDep }),
      resource: resourceView({ capabilities: [], byEvent: emptyRes }),
      communication: communicationView({ sessions: [], byEvent: emptyComm }),
      structure: structureView({
        composition: { kind: "box" },
        structuralLinks: [],
        byEvent: emptyStruct,
      }),
      diagnostic: {
        stats: {
          changes: 0,
          participants: 0,
          artifacts: 0,
          links: 0,
          sessions: 0,
          capabilities: 0,
          observations: 0,
        },
        compositionHint: { kind: "box" },
      },
    });
    const bad = {
      ...bundle,
      diagnostic: {
        ...bundle.diagnostic!,
        nested: [{ effectiveFootprint: { artifactIds: [] } }],
      },
    };
    const world = observationWorld({
      snapshotRef: snapshot.snapshotRef,
      snapshot,
      validatedHistory: toValidatedHistory(),
      changes: [],
      sinceRef: snapshot.snapshotRef,
    });
    const result = validateCrossViewInvariants(bad as typeof bundle, world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E7_no_scheduling_fields")).toBe(true);
  });

  it("accepts valid empty T0 bundle", () => {
    const snapshot = buildConfigT0();
    const emptyDep = createEventTagIndex<DependencyDelta>([]);
    const emptyRes = createEventTagIndex<ResourceDelta>([]);
    const emptyComm = createEventTagIndex<CommunicationDelta>([]);
    const emptyStruct = createEventTagIndex<StructureDelta>([]);
    const bundle = fourViewBundle({
      spine: buildEventSpine([]),
      dependency: dependencyView({ links: [], byEvent: emptyDep }),
      resource: resourceView({ capabilities: [], byEvent: emptyRes }),
      communication: communicationView({ sessions: [], byEvent: emptyComm }),
      structure: structureView({
        composition: { kind: "parallel", parts: [] },
        structuralLinks: [],
        byEvent: emptyStruct,
      }),
    });
    const world = observationWorld({
      snapshotRef: snapshot.snapshotRef,
      snapshot,
      validatedHistory: toValidatedHistory(),
      changes: [],
      sinceRef: snapshot.snapshotRef,
    });
    expect(validateCrossViewInvariants(bundle, world).ok).toBe(true);
  });
});
