import { describe, expect, it } from "vitest";
import {
  coordinationIntent,
  matchBinding,
  operationTypeId,
  actorRef,
  contentRef,
  evidenceRef,
  evidenceId,
} from "@cantilune/core";
import { storyActorIds, storyEntityIds } from "@cantilune/test-fixtures";
import { buildTestRuntime } from "../support/buildTestRuntime.js";
import { createObservabilityService } from "../../src/engine/observabilityService.js";
import { createObservationIndex } from "../../src/index/observationIndex.js";
import { validateCrossViewInvariants } from "../../src/invariants/crossViewInvariants.js";
import {
  observeCommittedExplicit,
  observeCommittedViaIndex,
} from "../support/scenario/observabilityHarness.js";
import { testArtifactContentRef } from "../support/contentRefs.js";

describe("T0→delegate observability integration", () => {
  it("folds FourViewBundle with core types and passes cross-view invariants", () => {
    const { runtime, t0, store, changelog, runHistory } = buildTestRuntime({
      snapshotRefs: ["snap-S-obs", "snap-S1", "snap-S2"],
      changeIds: ["chg-001", "chg-7f3a"],
      sessionIds: [storyEntityIds.session],
      linkIds: ["link-waits-1"],
    });

    const observeSource = actorRef(storyActorIds.human, "human");
    const observeResult = runtime.observe(
      { source: observeSource, payloadRef: contentRef("content://req-login") },
      { principal: observeSource },
    );
    expect("snapshot" in observeResult).toBe(true);
    if (!("snapshot" in observeResult)) {
      return;
    }

    const introduceAdmitted = runtime.admit(
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
    expect(introduceAdmitted.ok).toBe(true);
    if (!introduceAdmitted.ok) {
      return;
    }
    const introduceCommit = runtime.commit(introduceAdmitted.ticket);
    expect("change" in introduceCommit).toBe(true);
    if (!("change" in introduceCommit)) {
      return;
    }

    const delegateAdmitted = runtime.admit(
      coordinationIntent(
        actorRef(storyActorIds.planner, "agent"),
        operationTypeId("delegate"),
        [
          matchBinding("task", storyEntityIds.task),
          matchBinding("from", storyActorIds.planner),
          matchBinding("to", storyActorIds.coder),
          matchBinding("capability", storyEntityIds.writeLock),
          matchBinding("participant", "reviewer-r" as typeof storyActorIds.planner),
        ],
        [
          evidenceRef(
            evidenceId("planner-authorized-delegation"),
            "policy",
            contentRef("content://auth/delegate-planner"),
          ),
        ],
      ),
    );
    expect(delegateAdmitted.ok).toBe(true);
    if (!delegateAdmitted.ok) {
      return;
    }
    const delegateCommit = runtime.commit(delegateAdmitted.ticket);
    expect("change" in delegateCommit).toBe(true);
    if (!("change" in delegateCommit)) {
      return;
    }

    const head = runtime.getHead();
    expect(head).toBeDefined();
    if (head === undefined) {
      return;
    }

    const sinceRef = observeResult.snapshot.snapshotRef;
    const ports = { runtime, store, changelog, runHistory, t0 };
    const closure = observeCommittedExplicit(ports, sinceRef, { attachEvidence: true });
    const bundle = closure.bundle;

    expect(closure.validation.ok).toBe(true);
    expect(closure.commitCount).toBe(2);
    expect(bundle.spine.events).toHaveLength(2);
    expect(bundle.resource.capabilities[0]?.holder).toBe(storyActorIds.coder);
    expect(bundle.communication.sessions).toHaveLength(1);
    expect(bundle.dependency.links.some((link) => link.kind === "waits_for")).toBe(true);
    expect(bundle.structure.composition.kind).toBe("serial");
    expect(bundle.diagnostic?.stats.changes).toBe(2);
    expect(bundle.evidence?.terminalFieldsMatchSnapshot).toBe(true);
    expect(bundle.evidence?.byEvent.size).toBe(2);

    const service = createObservabilityService();
    const viaService = service.observeCommitted(
      {
        head: () => head.snapshotRef,
        getSnapshot: (ref) => store.get(ref),
        changesSince: (ref) => changelog.since(ref),
        runHistory: () => runHistory.current(),
      },
      sinceRef,
      { attachEvidence: true },
    );
    expect(validateCrossViewInvariants(viaService, closure.world).ok).toBe(true);
    expect(observeCommittedViaIndex(ports, sinceRef).spine.events).toHaveLength(2);
  });

  it("observeCommitted resolves historical snapshots via ports.getSnapshot without explicit snapshotReader", () => {
    const { runtime, t0, store, changelog, runHistory } = buildTestRuntime({
      snapshotRefs: ["snap-S1", "snap-S2"],
      changeIds: ["chg-001"],
    });
    const admitted = runtime.admit(
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
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }
    const commit = runtime.commit(admitted.ticket);
    expect("change" in commit).toBe(true);
    if (!("change" in commit)) {
      return;
    }

    const index = createObservationIndex();
    const bundle = index.observeCommitted(
      {
        head: () => runtime.getHead()?.snapshotRef,
        getSnapshot: (ref) => store.get(ref),
        changesSince: (ref) => changelog.since(ref),
        runHistory: () => runHistory.current(),
      },
      t0.snapshotRef,
    );
    expect(bundle.spine.events).toHaveLength(1);
    expect(store.get(t0.snapshotRef)).toBeDefined();
    expect(store.get(runtime.getHead()?.snapshotRef ?? t0.snapshotRef)).toBeDefined();
  });
});
