import { describe, expect, it } from "vitest";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { collaborationSnapshot, snapshotRef } from "@cantilune/core";
import {
  assembleObservationWorld,
  createSnapshotResolver,
  resolveSnapshotStrict,
} from "../../../src/input/assembleWorld.js";
import { readObservationCutFromPorts } from "../../../src/input/observationCut.js";
import { createObservationReadPorts } from "../../../src/input/observationInput.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";
import { expectReadOnlyViolation } from "../../support/assertions/violations.js";

describe("assembleObservationWorld", () => {
  it("rejects headRef mismatch against snapshot", () => {
    const snapshot = buildConfigT0();
    expect(
      expectReadOnlyViolation(
        () =>
          assembleObservationWorld({
            headRef: snapshotRef("snap-other"),
            sinceRef: snapshot.snapshotRef,
            snapshot,
            changes: [],
            validatedHistory: toValidatedHistory(),
          }),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("rejects historical window without snapshotReader", () => {
    const snapshot = buildConfigT0();
    expect(
      expectReadOnlyViolation(
        () =>
          assembleObservationWorld(
            {
              headRef: snapshotRef("snap-S1"),
              sinceRef: snapshotRef("snap-S0"),
              snapshot,
              changes: [],
              validatedHistory: toValidatedHistory(),
            },
            {},
          ),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("skips cut validation when validateChain is false", () => {
    const snapshot = buildConfigT0();
    const world = assembleObservationWorld(
      {
        headRef: snapshotRef("snap-other"),
        sinceRef: snapshot.snapshotRef,
        snapshot,
        changes: [],
        validatedHistory: toValidatedHistory(),
      },
      { validateChain: false },
    );
    expect(world.snapshotRef).toBe(snapshotRef("snap-other"));
  });

  it("createSnapshotResolver clones historical snapshots from reader", () => {
    const head = buildConfigT0();
    const historical = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: head.epochId,
    });
    const resolver = createSnapshotResolver(head, {
      get: (ref) => (ref === historical.snapshotRef ? historical : undefined),
    });
    const resolved = resolver.resolve(historical.snapshotRef);
    expect(resolved?.snapshotRef).toBe(historical.snapshotRef);
    expect(resolved).not.toBe(historical);
  });

  it("resolveSnapshotStrict rejects resolver returning mismatched ref", () => {
    const wrong = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-wrong"),
      epochId: buildConfigT0().epochId,
    });
    expect(
      expectReadOnlyViolation(
        () => resolveSnapshotStrict({ resolve: () => wrong }, snapshotRef("snap-S1"), "headRef"),
        "snapshot_unavailable",
      ).code,
    ).toBe("snapshot_unavailable");
  });
});

describe("readObservationCutFromPorts", () => {
  it("throws when head is missing", () => {
    const ports = createObservationReadPorts({
      head: () => undefined,
      getSnapshot: () => undefined,
      changesSince: () => [],
    });
    expect(
      expectReadOnlyViolation(
        () => readObservationCutFromPorts(ports, snapshotRef("snap-S0")),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });
});
