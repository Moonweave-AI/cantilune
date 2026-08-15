import { describe, expect, it } from "vitest";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { snapshotRef } from "@cantilune/core";
import { createObservationIndex } from "../../../src/index/observationIndex.js";
import { createObservationReadPorts } from "../../../src/input/observationInput.js";
import { expectReadOnlyViolation } from "../../support/assertions/violations.js";

describe("invalid observation input", () => {
  it("observeCommitted throws invalid_input when ports cannot resolve head", () => {
    const index = createObservationIndex();
    const snapshot = buildConfigT0();
    const ports = createObservationReadPorts({
      head: () => undefined,
      getSnapshot: () => snapshot,
      changesSince: () => [],
    });
    expect(
      expectReadOnlyViolation(
        () => index.observeCommitted(ports, snapshot.snapshotRef),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("observeCommitted throws invalid_input when snapshot reader returns undefined", () => {
    const index = createObservationIndex();
    const ports = createObservationReadPorts({
      head: () => snapshotRef("snap-S1"),
      getSnapshot: () => undefined,
      changesSince: () => [],
    });
    expect(
      expectReadOnlyViolation(
        () => index.observeCommitted(ports, snapshotRef("snap-S0")),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });
});
