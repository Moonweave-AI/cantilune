import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ContentDigest } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import { oracleId } from "../foundation/evaluationIds.js";
import type { OracleResult } from "../foundation/evaluationStatus.js";
import {
  leanSymbol,
  type LeanTheoremSymbol,
  type TheoryOracleEvidence,
  type PremiseField,
} from "./theoryOracleEvidence.js";

export interface ProofObligationRecord {
  readonly id: string;
  readonly theorem: string;
  readonly status: string;
  readonly leanSymbol: string;
  readonly verifiedCommit?: string | null;
  readonly notes?: string | null;
}

export interface ProofObligationsDocument {
  readonly schemaVersion: number;
  readonly obligations: readonly ProofObligationRecord[];
}

/**
 * Load formal/proof-obligations.json from a repo root (or absolute path).
 * Returns undefined when the file is missing — callers must treat as premiseMissing.
 */
export function loadProofObligations(
  repoRootOrFile: string,
): ProofObligationsDocument | undefined {
  const candidate = repoRootOrFile.endsWith("proof-obligations.json")
    ? repoRootOrFile
    : resolve(repoRootOrFile, "formal", "proof-obligations.json");
  if (!existsSync(candidate)) return undefined;
  try {
    const raw = readFileSync(candidate, "utf8");
    const parsed = JSON.parse(raw) as ProofObligationsDocument;
    if (!Array.isArray(parsed.obligations)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export interface TheoryOracleEvaluationInput {
  readonly oracleCode: string;
  readonly leanSymbol: string;
  readonly premises: Readonly<Record<string, unknown>>;
  readonly premiseSchema: readonly PremiseField[];
  readonly evaluatorRef: string;
  readonly repoRoot: string;
}

/**
 * Evaluate a theory oracle against formal/proof-obligations.json.
 * Missing premises or missing obligation declarations → premiseMissing (never pass).
 */
export function evaluateTheoryOracleFromObligations(
  input: TheoryOracleEvaluationInput,
): TheoryOracleEvidence {
  const now = new Date().toISOString();
  const emptyDigest = contentDigest(createHash("sha256").update("empty").digest("hex"));

  const missingPremises = input.premiseSchema
    .filter((p) => p.required)
    .filter((p) => {
      const v = input.premises[p.name];
      return v === undefined || v === null || v === "";
    })
    .map((p) => p.name);

  let result: OracleResult = "premiseMissing";
  const expected = "obligation.proved";
  let observed = "premiseMissing";
  let symbol: LeanTheoremSymbol;
  try {
    symbol = leanSymbol(input.leanSymbol);
  } catch {
    return buildEvidence({
      oracleCode: input.oracleCode,
      leanSymbol: "Cantilune.INVALID" as LeanTheoremSymbol,
      result: "premiseMissing",
      expected,
      observed: "invalid-lean-symbol",
      evaluatorRef: input.evaluatorRef,
      now,
      emptyDigest,
      counterexampleRef: undefined,
    });
  }

  if (missingPremises.length > 0) {
    return buildEvidence({
      oracleCode: input.oracleCode,
      leanSymbol: symbol,
      result: "premiseMissing",
      expected,
      observed: `missing:${missingPremises.join(",")}`,
      evaluatorRef: input.evaluatorRef,
      now,
      emptyDigest,
      counterexampleRef: undefined,
    });
  }

  const doc = loadProofObligations(input.repoRoot);
  if (doc === undefined) {
    return buildEvidence({
      oracleCode: input.oracleCode,
      leanSymbol: symbol,
      result: "premiseMissing",
      expected,
      observed: "proof-obligations.json missing",
      evaluatorRef: input.evaluatorRef,
      now,
      emptyDigest,
      counterexampleRef: undefined,
    });
  }

  const obligation = doc.obligations.find((o) => o.leanSymbol === input.leanSymbol);
  if (obligation === undefined) {
    return buildEvidence({
      oracleCode: input.oracleCode,
      leanSymbol: symbol,
      result: "premiseMissing",
      expected,
      observed: "obligation-not-listed",
      evaluatorRef: input.evaluatorRef,
      now,
      emptyDigest,
      counterexampleRef: undefined,
    });
  }

  observed = obligation.status;
  if (obligation.status === "proved" || obligation.status === "reviewed") {
    result = "passed";
  } else if (obligation.status === "missing" || obligation.status === "partial_scaffold") {
    result = "premiseMissing";
  } else if (obligation.status === "implemented_unverified") {
    result = "checkerUnavailable";
  } else {
    result = "failed";
  }

  return buildEvidence({
    oracleCode: input.oracleCode,
    leanSymbol: symbol,
    result,
    expected,
    observed,
    evaluatorRef: input.evaluatorRef,
    now,
    emptyDigest,
    counterexampleRef: result === "failed" ? obligation.id : undefined,
  });
}

function buildEvidence(args: {
  oracleCode: string;
  leanSymbol: LeanTheoremSymbol;
  result: OracleResult;
  expected: string;
  observed: string;
  evaluatorRef: string;
  now: string;
  emptyDigest: ContentDigest;
  counterexampleRef: string | undefined;
}): TheoryOracleEvidence {
  const id = oracleId(`oracle-${args.oracleCode}`);
  const digest = contentDigest(
    createHash("sha256")
      .update(
        JSON.stringify({
          code: args.oracleCode,
          result: args.result,
          observed: args.observed,
        }),
      )
      .digest("hex"),
  );
  return {
    oracleId: id,
    oracleVersion: 1,
    oracleCode: args.oracleCode,
    centralObligationId: args.oracleCode,
    leanSymbol: args.leanSymbol,
    semanticLayer: "effect",
    theoryCommit: "local",
    theoryBuildDigest: args.emptyDigest,
    theoryManifestDigest: args.emptyDigest,
    proofManifestDigest: args.emptyDigest,
    premiseEvidenceRefs: [],
    inputEvidenceRefs: [],
    scopeCeiling: "engineering",
    checkerBuild: "proof-obligations-reader",
    checkerDigest: args.emptyDigest,
    expected: args.expected,
    observed: args.observed,
    result: args.result,
    counterexampleRef: args.counterexampleRef,
    evaluatorRef: args.evaluatorRef,
    evaluatedAt: args.now,
    oracleDigest: digest,
  };
}
