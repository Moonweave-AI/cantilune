import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateTheoryOracleFromObligations,
  loadProofObligations,
} from "../../src/oracles/proofObligationsOracle.js";
import { createMinimalC1C4Corpus } from "../../src/corpus/minimalC1C4Corpus.js";
import {
  createAdversarialCaseFixtures,
  createIsolatedModelJudge,
  createModelTextScorer,
  submitHumanScore,
  defaultModelJudgeProtocol,
} from "../../src/scoring/scoringPaths.js";
import { metricId, evaluationClaimId, scorerRef } from "../../src/foundation/evaluationIds.js";
import type { MetricDefinition } from "../../src/scoring/metricDefinition.js";
import { contentDigest } from "@cantilune/core";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

describe("proofObligationsOracle", () => {
  it("loads formal/proof-obligations.json", () => {
    const doc = loadProofObligations(repoRoot);
    expect(doc).toBeDefined();
    expect(doc!.obligations.length).toBeGreaterThan(0);
  });

  it("returns premiseMissing when required premises are absent", () => {
    const evidence = evaluateTheoryOracleFromObligations({
      oracleCode: "evaluation.c1",
      leanSymbol: "Cantilune.Core.dpo_result_unique",
      premises: {},
      premiseSchema: [{ name: "snapshot", type: "string", required: true, description: "snap" }],
      evaluatorRef: "test",
      repoRoot,
    });
    expect(evidence.result).toBe("premiseMissing");
  });

  it("passes when obligation is proved and premises present", () => {
    const evidence = evaluateTheoryOracleFromObligations({
      oracleCode: "evaluation.c1",
      leanSymbol: "Cantilune.Core.dpo_result_unique",
      premises: { snapshot: "snap:t0" },
      premiseSchema: [{ name: "snapshot", type: "string", required: true, description: "snap" }],
      evaluatorRef: "test",
      repoRoot,
    });
    expect(evidence.result).toBe("passed");
  });
});

describe("minimal C1-C4 corpus", () => {
  it("provides four claim fixtures", () => {
    const fixtures = createMinimalC1C4Corpus();
    expect(fixtures.map((f) => f.claimCode)).toEqual([
      "evaluation.c1",
      "evaluation.c2",
      "evaluation.c3",
      "evaluation.c4",
    ]);
    for (const f of fixtures) {
      expect(f.suite.status).toBe("frozen");
      expect(f.cases.length).toBeGreaterThan(0);
    }
  });
});

describe("scoring paths", () => {
  it("scores exact text matches", async () => {
    const scorer = createModelTextScorer();
    const digest = contentDigest("a".repeat(64));
    const metric = {
      metricId: metricId("m1"),
      metricVersion: 1,
      claimRef: evaluationClaimId("evaluation.c1"),
      endpointRole: "primary",
      inputSchemaRef: "schema",
      scorerRef: scorerRef("text"),
      scorerBuild: "test",
      scorerDigest: digest,
      unit: "score",
      direction: "higherIsBetter",
      population: "smoke",
      stratification: [],
      aggregation: "mean",
      failureTreatment: "zero",
      missingTreatment: "exclude",
      threshold: undefined,
      equivalenceMargin: undefined,
      uncertaintyMethod: "none",
      effectSizeMethod: "none",
      judgeProtocolRef: undefined,
      metricDigest: digest,
    } as MetricDefinition;
    const result = await scorer.score(metric, ["hello"], ["hello"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rawValue).toBe(1);
  });

  it("rejects human self-review", () => {
    const protocol = defaultModelJudgeProtocol();
    const result = submitHumanScore({
      protocol,
      reviewerId: "r1",
      reviewerRole: "reviewer",
      planRef: "plan",
      resultRef: "r1",
      evidenceRootRef: "ev",
      decision: "approve",
      rationale: "ok",
      coiDeclaration: "none",
      reviewerSignature: "sig",
    });
    expect(result.ok).toBe(false);
  });

  it("ships adversarial fixtures", () => {
    expect(createAdversarialCaseFixtures().length).toBeGreaterThanOrEqual(4);
  });

  it("isolated model judge rejects tools/network/secrets", async () => {
    const judge = createIsolatedModelJudge(async () => ({ score: 1, rationale: "ok" }));
    const blocked = await judge.judge("a", "b", "rubric", {
      judgeType: "llm",
      masked: true,
      randomizedOrder: false,
      seed: 1,
      toolsEnabled: true,
    });
    expect(blocked.ok).toBe(false);
  });

  it("covers scorer misses, judge isolation, and human-score rejections", async () => {
    const scorer = createModelTextScorer();
    const digest = contentDigest("b".repeat(64));
    const metric = {
      metricId: metricId("m2"),
      metricVersion: 1,
      claimRef: evaluationClaimId("evaluation.c1"),
      endpointRole: "primary",
      inputSchemaRef: "schema",
      scorerRef: scorerRef("text"),
      scorerBuild: "test",
      scorerDigest: digest,
      unit: "score",
      direction: "higher",
      population: "smoke",
      stratification: [],
      aggregation: "mean",
      failureTreatment: "exclude",
      missingTreatment: "exclude",
      threshold: undefined,
      equivalenceMargin: undefined,
      uncertaintyMethod: "none",
      effectSizeMethod: "none",
      judgeProtocolRef: undefined,
      metricDigest: digest,
    } as MetricDefinition;
    expect((await scorer.score(metric, ["hello"], [])).ok).toBe(false);
    const fuzzy = await scorer.score(metric, ["Hello"], ["say hello there"]);
    expect(fuzzy.ok).toBe(true);
    const emptyExpected = await scorer.score(metric, [""], ["x"]);
    expect(emptyExpected.ok).toBe(true);
    const miss = await scorer.score({ ...metric, unit: undefined as never }, ["zzz"], ["nope"]);
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value.rawValue).toBe(0);

    const judge = createIsolatedModelJudge(async (prompt) => {
      if (prompt.includes("boom")) throw new Error("judge down");
      if (prompt.includes("throw-string")) throw "nope";
      if (prompt.includes("bad-score")) return { score: 2, rationale: "bad" };
      return { score: 0.5, rationale: "ok" };
    });
    expect(
      (
        await judge.judge("a", "b", "rubric", {
          judgeType: "human",
          masked: false,
          randomizedOrder: false,
          seed: undefined,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await judge.judge("a", "b", "rubric", {
          judgeType: "llm",
          masked: false,
          randomizedOrder: true,
          seed: 1,
          networkEnabled: true,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await judge.judge("a", "b", "rubric", {
          judgeType: "llm",
          masked: true,
          randomizedOrder: false,
          seed: 0,
          secretsPresent: true,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await judge.judge("a", "b", "boom", {
          judgeType: "llm",
          masked: false,
          randomizedOrder: true,
          seed: 2,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await judge.judge("a", "b", "throw-string", {
          judgeType: "llm",
          masked: true,
          randomizedOrder: false,
          seed: 0,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await judge.judge("a", "b", "bad-score", {
          judgeType: "llm",
          masked: true,
          randomizedOrder: false,
          seed: 0,
        })
      ).ok,
    ).toBe(false);
    const okJudge = await judge.judge("cand", "base", "rubric", {
      judgeType: "llm",
      masked: false,
      randomizedOrder: true,
      seed: 1,
    });
    expect(okJudge.ok).toBe(true);

    const unsafe = defaultModelJudgeProtocol();
    const unsafeProtocol = { ...unsafe, selfReviewProhibited: false };
    expect(
      submitHumanScore({
        protocol: unsafeProtocol,
        reviewerId: "r2",
        reviewerRole: "reviewer",
        planRef: "plan",
        resultRef: "other",
        evidenceRootRef: "ev",
        decision: "approve",
        rationale: "ok",
        coiDeclaration: "none",
        reviewerSignature: "sig",
      }).ok,
    ).toBe(false);
    expect(
      submitHumanScore({
        protocol: unsafe,
        reviewerId: "r2",
        reviewerRole: "reviewer",
        planRef: "plan",
        resultRef: "other",
        evidenceRootRef: "ev",
        decision: "approve",
        rationale: "ok",
        coiDeclaration: "I have a conflict",
        reviewerSignature: "sig",
      }).ok,
    ).toBe(false);
    expect(
      submitHumanScore({
        protocol: unsafe,
        reviewerId: "r2",
        reviewerRole: "reviewer",
        planRef: "plan",
        resultRef: "other",
        evidenceRootRef: "ev",
        decision: "approve",
        rationale: "ok",
        coiDeclaration: "none",
        reviewerSignature: "",
      }).ok,
    ).toBe(false);
    const accepted = submitHumanScore({
      protocol: unsafe,
      reviewerId: "r2",
      reviewerRole: "reviewer",
      planRef: "plan",
      resultRef: "other",
      evidenceRootRef: "ev",
      decision: "approve",
      rationale: "ok",
      limitations: ["draft"],
      coiDeclaration: "none",
      reviewerSignature: "sig",
    });
    expect(accepted.ok).toBe(true);
  });
});
