import { describe, expect, it } from "vitest";
import {
  appendRewriteSegment,
  changeId,
  collaborationSnapshot,
  coordinationChange,
  coordinationIntent,
  emptyRunHistory,
  epochId,
  matchBinding,
  operationTypeId,
  snapshotRef,
  timestamp,
  actorRef,
  actorId,
} from "@cantilune/core";
import { buildConfigT0, storyActorIds, storyEntityIds } from "@cantilune/test-fixtures";
import {
  readObservationCutFromPorts,
  validateObservationCut,
} from "../../../src/input/observationCut.js";
import { createObservationReadPorts } from "../../../src/input/observationInput.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";
import { expectReadOnlyViolation } from "../../support/assertions/violations.js";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { testArtifactContentRef } from "../../support/contentRefs.js";

function singleChangeInput() {
  const snapS0 = snapshotRef("snap-S0");
  const snapS1 = snapshotRef("snap-S1");
  const planner = actorId("planner-p");
  const change = coordinationChange({
    changeId: changeId("chg-001"),
    recordedAt: timestamp("2026-08-07T10:00:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapS0,
    afterRef: snapS1,
    matchBindings: [],
    initiator: actorRef(planner, "agent"),
    visibility: "external",
  });
  const snapshot = collaborationSnapshot({ snapshotRef: snapS1, epochId: epochId("42") });
  const history = appendRewriteSegment(emptyRunHistory(), change);
  return {
    headRef: snapS1,
    sinceRef: snapS0,
    snapshot,
    changes: [change],
    validatedHistory: toValidatedHistory(history),
  };
}

describe("validateObservationCut", () => {
  it("accepts empty window when sinceRef equals headRef", () => {
    const snapshot = buildConfigT0();
    expect(() =>
      validateObservationCut({
        headRef: snapshot.snapshotRef,
        sinceRef: snapshot.snapshotRef,
        snapshot,
        changes: [],
        validatedHistory: toValidatedHistory(),
      }),
    ).not.toThrow();
  });

  it("rejects empty window when sinceRef differs from headRef", () => {
    const snapshot = buildConfigT0();
    expect(
      expectReadOnlyViolation(
        () =>
          validateObservationCut({
            headRef: snapshot.snapshotRef,
            sinceRef: snapshotRef("snap-other"),
            snapshot,
            changes: [],
            validatedHistory: toValidatedHistory(),
          }),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("rejects duplicate changeId in window", () => {
    const input = singleChangeInput();
    expect(
      expectReadOnlyViolation(
        () =>
          validateObservationCut({
            ...input,
            changes: [input.changes[0]!, input.changes[0]!],
          }),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("rejects first change beforeRef mismatch", () => {
    const input = singleChangeInput();
    const badChange = { ...input.changes[0]!, beforeRef: snapshotRef("snap-wrong") };
    expect(
      expectReadOnlyViolation(
        () =>
          validateObservationCut({
            ...input,
            changes: [badChange],
          }),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("rejects last change afterRef mismatch", () => {
    const input = singleChangeInput();
    const badChange = { ...input.changes[0]!, afterRef: snapshotRef("snap-wrong") };
    expect(
      expectReadOnlyViolation(
        () =>
          validateObservationCut({
            ...input,
            changes: [badChange],
          }),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("rejects gap in change chain", () => {
    const snapS0 = snapshotRef("snap-S0");
    const snapS1 = snapshotRef("snap-S1");
    const snapS2 = snapshotRef("snap-S2");
    const planner = actorId("planner-p");
    const change1 = coordinationChange({
      changeId: changeId("chg-001"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapS0,
      afterRef: snapS1,
      matchBindings: [],
      initiator: actorRef(planner, "agent"),
      visibility: "external",
    });
    const change2 = coordinationChange({
      changeId: changeId("chg-002"),
      recordedAt: timestamp("2026-08-07T10:01:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapS0,
      afterRef: snapS2,
      matchBindings: [],
      initiator: actorRef(planner, "agent"),
      visibility: "external",
    });
    const snapshot = collaborationSnapshot({ snapshotRef: snapS2, epochId: epochId("42") });
    expect(
      expectReadOnlyViolation(
        () =>
          validateObservationCut({
            headRef: snapS2,
            sinceRef: snapS0,
            snapshot,
            changes: [change1, change2],
            validatedHistory: { kind: "validated", segments: [] },
          }),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("rejects change epoch mismatch with head snapshot", () => {
    const input = singleChangeInput();
    const badChange = { ...input.changes[0]!, epochId: epochId("99") };
    expect(
      expectReadOnlyViolation(
        () =>
          validateObservationCut({
            ...input,
            changes: [badChange],
          }),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("accepts valid single-change window", () => {
    expect(() => validateObservationCut(singleChangeInput())).not.toThrow();
  });
});

describe("readObservationCutFromPorts", () => {
  it("reads stable empty cut from ports", () => {
    const snapshot = buildConfigT0();
    const ports = createObservationReadPorts({
      head: () => snapshot.snapshotRef,
      getSnapshot: (ref) => (ref === snapshot.snapshotRef ? snapshot : undefined),
      changesSince: () => [],
      runHistory: () => emptyRunHistory(),
    });
    const input = readObservationCutFromPorts(ports, snapshot.snapshotRef);
    expect(input.headRef).toBe(snapshot.snapshotRef);
    expect(input.changes).toHaveLength(0);
  });

  it("throws when snapshot for head is unavailable", () => {
    const ports = createObservationReadPorts({
      head: () => snapshotRef("snap-S1"),
      getSnapshot: () => undefined,
      changesSince: () => [],
    });
    expect(
      expectReadOnlyViolation(
        () => readObservationCutFromPorts(ports, snapshotRef("snap-S0"), 1),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("throws when runHistory is missing for non-empty window", () => {
    const input = singleChangeInput();
    const ports = createObservationReadPorts({
      head: () => input.headRef,
      getSnapshot: (ref) => (ref === input.headRef ? input.snapshot : undefined),
      changesSince: () => input.changes,
    });
    expect(
      expectReadOnlyViolation(
        () => readObservationCutFromPorts(ports, input.sinceRef, 1),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("throws when runHistory changeIds do not match window", () => {
    const input = singleChangeInput();
    const mismatchedChange = coordinationChange({
      ...input.changes[0]!,
      changeId: changeId("chg-other"),
    });
    const ports = createObservationReadPorts({
      head: () => input.headRef,
      getSnapshot: (ref) => (ref === input.headRef ? input.snapshot : undefined),
      changesSince: () => input.changes,
      runHistory: () => appendRewriteSegment(emptyRunHistory(), mismatchedChange),
    });
    expect(
      expectReadOnlyViolation(
        () => readObservationCutFromPorts(ports, input.sinceRef, 1),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("throws when cut remains unstable after max attempts", () => {
    let flip = false;
    const snapshot = buildConfigT0();
    const ports = createObservationReadPorts({
      head: () => {
        flip = !flip;
        return flip ? snapshotRef("snap-A") : snapshotRef("snap-B");
      },
      getSnapshot: (ref) =>
        ref === snapshot.snapshotRef ||
        ref === snapshotRef("snap-A") ||
        ref === snapshotRef("snap-B")
          ? snapshot
          : undefined,
      changesSince: () => [],
      runHistory: () => emptyRunHistory(),
    });
    expect(
      expectReadOnlyViolation(
        () => readObservationCutFromPorts(ports, snapshot.snapshotRef, 1),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("reads stable non-empty cut after runtime commit", () => {
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

    const ports = createObservationReadPorts({
      head: () => deps.runtime.getHead()?.snapshotRef,
      getSnapshot: (ref) => deps.store.get(ref),
      changesSince: (ref) => deps.changelog.since(ref),
      runHistory: () => deps.runHistory.current(),
    });
    const input = readObservationCutFromPorts(ports, deps.t0.snapshotRef);
    expect(input.changes).toHaveLength(1);
    expect(input.headRef).toBe(deps.runtime.getHead()?.snapshotRef);
  });
});
