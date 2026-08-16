import { describe, expect, it } from "vitest";
import { bindEvidenceToObservations } from "../../src/collection/bindEvidenceToObservations.js";
import { collectCertifiedTraceEvidence } from "../../src/collection/collectCertifiedTraceEvidence.js";
import { makeObservation } from "../support/makeObservation.js";
import type { TheoryOracleEvidence } from "../../src/oracles/theoryOracleEvidence.js";
describe("bindEvidenceToObservations", () => {
  it("attaches trace and oracle refs to valid observations", () => {
    const trace = collectCertifiedTraceEvidence({
      coreEventRef: "chg-1",
      coreChangeDigest: "d",
      beforeRef: "a",
      afterRef: "b",
      executionEpoch: "1",
      views: { dag: {}, petri: {}, piCalc: {}, morphism: {} },
    });
    expect(trace.ok).toBe(true);
    if (!trace.ok) return;
    const oracle = {
      oracleCode: "e8.replay",
      result: "premiseMissing",
    } as TheoryOracleEvidence;
    const bound = bindEvidenceToObservations({
      observations: [makeObservation({ evidenceRefs: ["local"] })],
      traces: [trace.value],
      oracles: [oracle],
    });
    expect(bound.ok).toBe(true);
    if (bound.ok) {
      expect(bound.value[0]?.evidenceRefs).toContain("trace:chg-1");
      expect(bound.value[0]?.evidenceRefs.some((ref) => ref.startsWith("oracle:"))).toBe(true);
    }
  });

  it("rejects a valid observation that still has no evidence", () => {
    const result = bindEvidenceToObservations({
      observations: [makeObservation({ evidenceRefs: [], status: "valid" })],
    });
    expect(result.ok).toBe(false);
  });
});
