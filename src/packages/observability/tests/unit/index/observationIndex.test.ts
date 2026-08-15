import { describe, expect, it } from "vitest";
import { buildConfigT0, storyActorIds, storyEntityIds } from "@cantilune/test-fixtures";
import { actorRef, coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import { createObservationIndex } from "../../../src/index/observationIndex.js";
import { assembleObservationWorld } from "../../../src/input/assembleWorld.js";
import { validateCrossViewInvariants } from "../../../src/invariants/crossViewInvariants.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { createObservationReadPorts } from "../../../src/input/observationInput.js";
import { testArtifactContentRef } from "../../support/contentRefs.js";

describe("ObservationIndex", () => {
  it("projects T0 snapshot with empty spine and parallel composition", () => {
    const index = createObservationIndex();
    const snapshot = buildConfigT0();
    const world = assembleObservationWorld({
      headRef: snapshot.snapshotRef,
      sinceRef: snapshot.snapshotRef,
      snapshot,
      changes: [],
      validatedHistory: toValidatedHistory(),
    });
    const bundle = index.fromWorld(world);
    expect(bundle.spine.events).toHaveLength(0);
    expect(bundle.resource.capabilities).toHaveLength(0);
    expect(bundle.structure.composition.kind).toBe("parallel");
    expect(validateCrossViewInvariants(bundle, world).ok).toBe(true);
  });

  it("skips diagnostic attachment when attachDiagnostic is false", () => {
    const index = createObservationIndex();
    const snapshot = buildConfigT0();
    const world = assembleObservationWorld({
      headRef: snapshot.snapshotRef,
      sinceRef: snapshot.snapshotRef,
      snapshot,
      changes: [],
      validatedHistory: toValidatedHistory(),
    });
    const bundle = index.fromWorld(world, { attachDiagnostic: false });
    expect(bundle.diagnostic).toBeUndefined();
  });

  it("fromInput projects without explicit world assembly", () => {
    const index = createObservationIndex();
    const snapshot = buildConfigT0();
    const bundle = index.fromInput({
      headRef: snapshot.snapshotRef,
      sinceRef: snapshot.snapshotRef,
      snapshot,
      changes: [],
      validatedHistory: toValidatedHistory(),
    });
    expect(bundle.spine.events).toHaveLength(0);
  });

  it("attachEvidence adds read-model derivation evidence", () => {
    const deps = buildTestRuntime({
      snapshotRefs: ["snap-S1", "snap-S2"],
      changeIds: ["chg-001"],
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
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      return;
    }
    const commit = deps.runtime.commit(admitted.ticket);
    expect("change" in commit).toBe(true);
    if (!("change" in commit)) {
      return;
    }

    const index = createObservationIndex();
    const ports = createObservationReadPorts({
      head: () => deps.runtime.getHead()?.snapshotRef,
      getSnapshot: (ref) => deps.store.get(ref),
      changesSince: (ref) => deps.changelog.since(ref),
      runHistory: () => deps.runHistory.current(),
    });
    const bundle = index.observeCommitted(ports, deps.t0.snapshotRef, { attachEvidence: true });
    expect(bundle.evidence?.terminalFieldsMatchSnapshot).toBe(true);
    expect(bundle.evidence?.byEvent.size).toBe(1);
  });

  it("validateInvariants false skips cross-view enforcement", () => {
    const index = createObservationIndex();
    const snapshot = buildConfigT0();
    const world = assembleObservationWorld({
      headRef: snapshot.snapshotRef,
      sinceRef: snapshot.snapshotRef,
      snapshot,
      changes: [],
      validatedHistory: toValidatedHistory(),
    });
    expect(() => index.fromWorld(world, { validateInvariants: false })).not.toThrow();
  });
});
