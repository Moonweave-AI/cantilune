import { createHash } from "node:crypto";
import type { ContentDigest } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import {
  benchmarkCaseId,
  benchmarkSuiteId,
  evaluationClaimId,
  type BenchmarkCaseId,
  type BenchmarkSuiteId,
} from "../foundation/evaluationIds.js";
import type { BenchmarkCase, BenchmarkSuite } from "../benchmarks/benchmarkSuite.js";

function digestOf(payload: unknown): ContentDigest {
  const hex = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return contentDigest(hex);
}

export type CorpusClaimCode = "evaluation.c1" | "evaluation.c2" | "evaluation.c3" | "evaluation.c4";

export interface CorpusFixture {
  readonly claimCode: CorpusClaimCode;
  readonly suite: BenchmarkSuite;
  readonly cases: readonly BenchmarkCase[];
}

function makeCase(
  id: string,
  suiteId: BenchmarkSuiteId,
  claimCode: CorpusClaimCode,
  prompt: string,
  expected: string,
): BenchmarkCase {
  return {
    caseId: benchmarkCaseId(id),
    suiteId,
    caseVersion: 1,
    caseKind: "structural",
    claimRefs: [evaluationClaimId(claimCode)],
    tags: [claimCode, "minimal-corpus"],
    stratum: "smoke",
    inputArtifactRefs: [`corpus:${claimCode}:${id}:input`],
    initialSnapshotRef: "snap:t0",
    schemaBindingRef: "schema:corpus",
    policyRef: "policy:deny-all",
    requiredCapabilities: [],
    requiredTools: [],
    networkPolicy: "deny",
    filesystemPolicy: "deny",
    semanticOracleRefs: [],
    successPredicateRef: `predicate:${expected}`,
    expectedTerminalClasses: ["success"],
    resourceCaps: {
      maxTokensInput: 1024,
      maxTokensOutput: 512,
      maxToolCalls: 0,
      maxNetworkRequests: 0,
      maxFilesystemOps: 0,
      maxCostCents: 0,
    },
    maxStructuralSteps: 16,
    maxExecutionEpochs: 1,
    engineeringTimeout: 30_000,
    redactionPolicyRef: "redact:none",
    caseDigest: digestOf({ id, claimCode, prompt, expected }),
  };
}

/**
 * Minimal C1–C4 corpus fixtures for in-process paired evaluation.
 * Not a public benchmark claim — engineering harness only.
 */
export function createMinimalC1C4Corpus(): readonly CorpusFixture[] {
  const fixtures: CorpusFixture[] = [];

  const specs: Array<{
    claim: CorpusClaimCode;
    name: string;
    cases: Array<{ id: string; prompt: string; expected: string }>;
  }> = [
    {
      claim: "evaluation.c1",
      name: "Replay uniqueness smoke",
      cases: [{ id: "c1-echo", prompt: "Echo event id evt-1", expected: "evt-1" }],
    },
    {
      claim: "evaluation.c2",
      name: "Admission binding smoke",
      cases: [{ id: "c2-bind", prompt: "Schema binding for epoch e1", expected: "schema:e1" }],
    },
    {
      claim: "evaluation.c3",
      name: "Projection parity smoke",
      cases: [
        {
          id: "c3-proj",
          prompt: "Four projection lenses",
          expected: "dag,petri,pi,morphism",
        },
      ],
    },
    {
      claim: "evaluation.c4",
      name: "Progress bound smoke",
      cases: [
        {
          id: "c4-progress",
          prompt: "Stable progress at least epsilon?",
          expected: "premise-check",
        },
      ],
    },
  ];

  for (const spec of specs) {
    const suiteId = benchmarkSuiteId(`suite-${spec.claim}`);
    const cases = spec.cases.map((c) =>
      makeCase(c.id, suiteId, spec.claim, c.prompt, c.expected),
    );
    const suite: BenchmarkSuite = {
      suiteId,
      suiteVersion: 1,
      name: spec.name,
      description: `Minimal ${spec.claim} corpus fixture`,
      claimRefs: [evaluationClaimId(spec.claim)],
      caseManifestRefs: cases.map((c) => c.caseId),
      datasetRefs: [],
      coverageTaxonomy: [spec.claim],
      requiredStrata: ["smoke"],
      samplingPolicy: "all",
      defaultRunPolicy: "in-process",
      defaultScoringPolicy: "exact-match",
      defaultBudgetPolicy: "zero-external",
      provenanceRef: "corpus:minimal-c1-c4",
      licenseRef: "internal",
      privacyReviewRef: "n/a",
      suiteDigest: digestOf({ suiteId, cases: cases.map((c) => c.caseId) }),
      status: "frozen",
      frozenAt: "2026-08-15T00:00:00.000Z",
      supersedes: undefined,
    };
    fixtures.push({ claimCode: spec.claim, suite, cases });
  }

  return fixtures;
}

export function corpusCaseIds(fixtures: readonly CorpusFixture[]): readonly BenchmarkCaseId[] {
  return fixtures.flatMap((f) => f.cases.map((c) => c.caseId));
}

export function corpusSuiteIds(fixtures: readonly CorpusFixture[]): readonly BenchmarkSuiteId[] {
  return fixtures.map((f) => f.suite.suiteId);
}
