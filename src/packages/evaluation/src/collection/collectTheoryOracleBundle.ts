/**
 * E8 theory-oracle bundle: evaluate declared Lean symbols against
 * formal/proof-obligations.json. premiseMissing is never pass.
 */
import { createHash } from "node:crypto";
import { contentDigest, type ContentDigest } from "@cantilune/core";
import { evaluateTheoryOracleFromObligations } from "../oracles/proofObligationsOracle.js";
import {
  KNOWN_LEAN_SYMBOLS,
  type PremiseField,
  type TheoryOracleEvidence,
} from "../oracles/theoryOracleEvidence.js";

export interface TheoryOracleBundle {
  readonly evaluatorRef: string;
  readonly repoRoot: string;
  readonly evidence: readonly TheoryOracleEvidence[];
  readonly passedCount: number;
  readonly premiseMissingCount: number;
  readonly failedCount: number;
  readonly checkerUnavailableCount: number;
  readonly bundleDigest: ContentDigest;
  readonly blocksClaimSupport: boolean;
}

export interface CollectTheoryOracleBundleInput {
  readonly repoRoot: string;
  readonly evaluatorRef: string;
  readonly leanSymbols?: readonly string[];
  readonly premises?: Readonly<Record<string, unknown>>;
  readonly premiseSchema?: readonly PremiseField[];
}

const DEFAULT_PREMISE_SCHEMA: readonly PremiseField[] = [
  {
    name: "proofManifest",
    type: "ref",
    required: true,
    description: "Pinned formal/proof-obligations.json identity",
  },
];

export function collectTheoryOracleBundle(input: CollectTheoryOracleBundleInput): TheoryOracleBundle {
  const symbols = input.leanSymbols ?? Object.values(KNOWN_LEAN_SYMBOLS);
  const premises = input.premises ?? { proofManifest: "formal/proof-obligations.json" };
  const schema = input.premiseSchema ?? DEFAULT_PREMISE_SCHEMA;
  const evidence = symbols.map((symbol, index) =>
    evaluateTheoryOracleFromObligations({
      oracleCode: `e8.${index}.${symbol.split(".").at(-1) ?? "symbol"}`,
      leanSymbol: symbol,
      premises,
      premiseSchema: schema,
      evaluatorRef: input.evaluatorRef,
      repoRoot: input.repoRoot,
    }),
  );
  const passedCount = evidence.filter((row) => row.result === "passed").length;
  const premiseMissingCount = evidence.filter((row) => row.result === "premiseMissing").length;
  const failedCount = evidence.filter((row) => row.result === "failed").length;
  const checkerUnavailableCount = evidence.filter((row) => row.result === "checkerUnavailable").length;
  const bundleDigest = contentDigest(
    createHash("sha256")
      .update(JSON.stringify(evidence.map((row) => ({ symbol: row.leanSymbol, result: row.result }))))
      .digest("hex"),
  );
  return {
    evaluatorRef: input.evaluatorRef,
    repoRoot: input.repoRoot,
    evidence,
    passedCount,
    premiseMissingCount,
    failedCount,
    checkerUnavailableCount,
    bundleDigest,
    blocksClaimSupport: failedCount > 0 || premiseMissingCount === evidence.length,
  };
}
