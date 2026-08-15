import { describe, expect, it } from "vitest";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import {
  compressDiagnostic,
  compressDiagnosticFromHistory,
} from "../../../src/diagnostic/diagnosticSummary.js";
import {
  assembleObservationWorld,
  createSnapshotResolver,
} from "../../../src/input/assembleWorld.js";
import { projectObservationWorld } from "../../../src/spine/projectionEngine.js";
import { toValidatedHistory } from "../../support/toValidatedHistory.js";

describe("diagnosticSummary", () => {
  it("compresses stats and structure composition hint", () => {
    const snapshot = buildConfigT0();
    const world = assembleObservationWorld({
      headRef: snapshot.snapshotRef,
      sinceRef: snapshot.snapshotRef,
      snapshot,
      changes: [],
      validatedHistory: toValidatedHistory(),
    });
    const projected = projectObservationWorld(world, createSnapshotResolver(snapshot));
    const summary = compressDiagnostic(world, projected.views.structure);
    expect(summary.stats.changes).toBe(0);
    expect(summary.compositionHint.kind).toBe("parallel");

    const fromHistory = compressDiagnosticFromHistory(world);
    expect(fromHistory.compositionHint.kind).toBe("parallel");
  });
});
