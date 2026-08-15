import { describe, it, expect } from "vitest";
import {
  isOraclePassed,
  isOraclePremiseMissing,
  createOracleRegistry,
  leanSymbol,
  KNOWN_LEAN_SYMBOLS,
  type OracleRegistryEntry,
} from "../../src/oracles/theoryOracleEvidence.js";
import type { TheoryOracleEvidence } from "../../src/oracles/theoryOracleEvidence.js";
import { oracleId } from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

function makeEvidence(result: TheoryOracleEvidence["result"]): TheoryOracleEvidence {
  return {
    oracleId: oracleId("o1"),
    oracleVersion: 1,
    oracleCode: "replay.unique",
    centralObligationId: "OBL-001",
    leanSymbol: KNOWN_LEAN_SYMBOLS.eventReplayUnique,
    semanticLayer: "effect",
    theoryCommit: "abc123",
    theoryBuildDigest: "build-digest" as ContentDigest,
    theoryManifestDigest: "manifest-digest" as ContentDigest,
    proofManifestDigest: "proof-digest" as ContentDigest,
    premiseEvidenceRefs: ["prem-1"],
    inputEvidenceRefs: ["input-1"],
    scopeCeiling: "core.replay",
    checkerBuild: "checker-build-1",
    checkerDigest: "checker-digest" as ContentDigest,
    expected: "unique",
    observed: "unique",
    result,
    counterexampleRef: undefined,
    evaluatorRef: "trusted-evaluator-1",
    evaluatedAt: "2026-01-20",
    oracleDigest: "oracle-digest" as ContentDigest,
  };
}

describe("TheoryOracleEvidence", () => {
  it("identifies passed oracle", () => {
    expect(isOraclePassed(makeEvidence("passed"))).toBe(true);
    expect(isOraclePassed(makeEvidence("failed"))).toBe(false);
  });

  it("identifies premiseMissing", () => {
    expect(isOraclePremiseMissing(makeEvidence("premiseMissing"))).toBe(true);
    expect(isOraclePremiseMissing(makeEvidence("passed"))).toBe(false);
  });

  it("premiseMissing is never passed", () => {
    const evidence = makeEvidence("premiseMissing");
    expect(isOraclePassed(evidence)).toBe(false);
    expect(isOraclePremiseMissing(evidence)).toBe(true);
  });

  it("checkerUnavailable is neither passed nor premiseMissing", () => {
    const evidence = makeEvidence("checkerUnavailable");
    expect(isOraclePassed(evidence)).toBe(false);
    expect(isOraclePremiseMissing(evidence)).toBe(false);
  });
});

describe("OracleRegistry", () => {
  it("registers and retrieves oracle entries", () => {
    const registry = createOracleRegistry();
    const entry: OracleRegistryEntry = {
      oracleCode: "replay.unique",
      centralObligationId: "OBL-001",
      leanSymbol: KNOWN_LEAN_SYMBOLS.eventReplayUnique,
      theoryCommit: "abc123",
      theoryBuildDigest: "build-d" as ContentDigest,
      theoryManifestDigest: "manifest-d" as ContentDigest,
      scopeCeiling: "core.replay",
      semanticLayer: "effect",
      typedPremiseSchema: [
        { name: "trace", type: "ValidatedRunHistory", required: true, description: "Run history" },
      ],
      checkerBuild: "checker-1",
      checkerDigest: "checker-d" as ContentDigest,
    };
    registry.register(entry);

    expect(registry.get("replay.unique")).toBeDefined();
    expect(registry.hasSymbol(KNOWN_LEAN_SYMBOLS.eventReplayUnique)).toBe(true);
    expect(registry.listAll()).toHaveLength(1);
  });

  it("returns undefined for unknown oracle code", () => {
    const registry = createOracleRegistry();
    expect(registry.get("unknown")).toBeUndefined();
  });
});

describe("leanSymbol", () => {
  it("accepts valid Lean symbols", () => {
    const sym = leanSymbol("Cantilune.Core.Test.theorem");
    expect(sym).toBe("Cantilune.Core.Test.theorem");
  });

  it("rejects non-Cantilune symbols", () => {
    expect(() => leanSymbol("Mathlib.Foo.bar")).toThrow("must start with 'Cantilune.'");
  });
});
