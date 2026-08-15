import { describe, expect, it } from "vitest";
import { validateCrossViewInvariants } from "../../../src/invariants/crossViewInvariants.js";
import { createEventTagIndex } from "../../../src/foundation/eventTagIndex.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { storyActorIds, storyEntityIds } from "@cantilune/test-fixtures";
import { coordinationIntent, matchBinding, operationTypeId, actorRef } from "@cantilune/core";
import { observeCommittedExplicit } from "../../support/scenario/observabilityHarness.js";
import { testArtifactContentRef } from "../../support/contentRefs.js";

async function buildValidClosure() {
  const deps = buildTestRuntime({
    snapshotRefs: ["snap-S1", "snap-S2"],
    changeIds: ["chg-001"],
    sessionIds: [storyEntityIds.session],
    linkIds: ["link-waits-1"],
  });
  const admitted = deps.runtime.admit(
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
  if (!admitted.ok) {
    throw new Error("admit failed");
  }
  const commit = deps.runtime.commit(admitted.ticket);
  if (!("change" in commit)) {
    throw new Error("commit failed");
  }
  return observeCommittedExplicit(deps, deps.t0.snapshotRef, { validateInvariants: false });
}

async function buildClosureWithDependencyLinks() {
  const deps = buildTestRuntime({
    snapshotRefs: ["snap-S1", "snap-S2", "snap-S3"],
    changeIds: ["chg-001", "chg-002"],
    sessionIds: [storyEntityIds.session],
    linkIds: ["link-waits-1"],
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
  return observeCommittedExplicit(deps, deps.t0.snapshotRef, { validateInvariants: false });
}

describe("cross-view invariants negative", () => {
  it("rejects missing byEvent slice (E1 coverage gap)", async () => {
    const closure = await buildValidClosure();
    const eventTag = closure.bundle.spine.events[0]?.eventTag;
    if (eventTag === undefined) {
      throw new Error("missing event");
    }
    const resourceByEvent = createEventTagIndex(
      [...closure.bundle.resource.byEvent.entries()]
        .filter(([tag]) => tag.changeId !== eventTag.changeId)
        .map(([tag, value]) => ({ tag, value })),
    );
    const bad = {
      ...closure.bundle,
      resource: { ...closure.bundle.resource, byEvent: resourceByEvent },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path?.startsWith("E1"))).toBe(true);
  });

  it("rejects resource capabilities diverging from snapshot (E3)", async () => {
    const closure = await buildValidClosure();
    const bad = {
      ...closure.bundle,
      resource: {
        ...closure.bundle.resource,
        capabilities: [],
      },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E3_capability_matches_snapshot")).toBe(true);
  });

  it("rejects omitted dependency links from snapshot (E4)", async () => {
    const closure = await buildClosureWithDependencyLinks();
    expect(closure.bundle.dependency.links.length).toBeGreaterThan(0);
    const bad = {
      ...closure.bundle,
      dependency: {
        ...closure.bundle.dependency,
        links: [],
      },
    };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E4_dependency_link_equality")).toBe(true);
  });

  it("rejects scheduling footprint fields on bundle (E7)", async () => {
    const closure = await buildValidClosure();
    const bad = { ...closure.bundle, footprint: { artifactIds: [] } };
    const result = validateCrossViewInvariants(bad, closure.world);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violations.some((v) => v.path === "E7_no_scheduling_fields")).toBe(true);
  });
});
