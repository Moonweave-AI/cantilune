import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectTheoryOracleBundle } from "../../src/collection/collectTheoryOracleBundle.js";
import { KNOWN_LEAN_SYMBOLS } from "../../src/oracles/theoryOracleEvidence.js";

describe("collectTheoryOracleBundle", () => {
  it("treats a missing manifest as premiseMissing and never as pass", () => {
    const bundle = collectTheoryOracleBundle({
      repoRoot: join(tmpdir(), "cantilune-missing-formal"),
      evaluatorRef: "e8-test",
      leanSymbols: [KNOWN_LEAN_SYMBOLS.eventReplayUnique],
    });
    expect(bundle.passedCount).toBe(0);
    expect(bundle.premiseMissingCount).toBe(1);
    expect(bundle.blocksClaimSupport).toBe(true);
  });

  it("reads proved and unverified obligations from a pinned manifest", () => {
    const root = join(tmpdir(), `cantilune-e8-${Date.now()}`);
    mkdirSync(join(root, "formal"), { recursive: true });
    writeFileSync(
      join(root, "formal", "proof-obligations.json"),
      JSON.stringify({
        schemaVersion: 2,
        obligations: [
          {
            id: "O1",
            theorem: "event_replay_unique",
            status: "proved",
            leanSymbol: KNOWN_LEAN_SYMBOLS.eventReplayUnique,
          },
          {
            id: "O2",
            theorem: "projection_step_sound",
            status: "implemented_unverified",
            leanSymbol: KNOWN_LEAN_SYMBOLS.projectionStepSound,
          },
          {
            id: "O3",
            theorem: "internal_rank_decrease",
            status: "failed",
            leanSymbol: KNOWN_LEAN_SYMBOLS.internalRankDecrease,
          },
        ],
      }),
    );
    const bundle = collectTheoryOracleBundle({
      repoRoot: root,
      evaluatorRef: "e8-test",
      leanSymbols: [
        KNOWN_LEAN_SYMBOLS.eventReplayUnique,
        KNOWN_LEAN_SYMBOLS.projectionStepSound,
        KNOWN_LEAN_SYMBOLS.internalRankDecrease,
      ],
    });
    expect(bundle.passedCount).toBe(1);
    expect(bundle.checkerUnavailableCount).toBe(1);
    expect(bundle.failedCount).toBe(1);
    expect(bundle.blocksClaimSupport).toBe(true);
  });

  it("fail-closes required premises and invalid symbols", () => {
    const missingPremise = collectTheoryOracleBundle({
      repoRoot: process.cwd(),
      evaluatorRef: "e8-test",
      leanSymbols: [KNOWN_LEAN_SYMBOLS.eventReplayUnique],
      premises: {},
    });
    expect(missingPremise.evidence[0]?.result).toBe("premiseMissing");

    const invalid = collectTheoryOracleBundle({
      repoRoot: process.cwd(),
      evaluatorRef: "e8-test",
      leanSymbols: ["NotCantilune.nope"],
    });
    expect(invalid.evidence[0]?.observed).toBe("invalid-lean-symbol");
  });
});
