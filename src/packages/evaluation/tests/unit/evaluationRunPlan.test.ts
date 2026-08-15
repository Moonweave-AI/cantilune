import { describe, it, expect } from "vitest";
import { isPlanFrozen, type EvaluationRunPlan } from "../../src/plans/evaluationRunPlan.js";
import {
  evaluationRunPlanId,
  evaluationProtocolId,
  evaluationClaimId,
  benchmarkSuiteId,
  evaluationSubjectId,
  budgetPolicyId,
} from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makePlan(overrides: Partial<EvaluationRunPlan> = {}): EvaluationRunPlan {
  return {
    planId: evaluationRunPlanId("plan-1"),
    protocolRef: evaluationProtocolId("proto-1"),
    claimRefs: [evaluationClaimId("c1")],
    suiteRef: benchmarkSuiteId("suite-1"),
    caseSelection: { mode: "all", caseIds: undefined, strata: undefined, maxCases: undefined },
    datasetSplitRefs: [],
    candidateSubjectRef: evaluationSubjectId("sub-1"),
    baselineSubjectRefs: [],
    pairedExecution: false,
    blockingFactors: [],
    randomizationOrder: [],
    blinding: {
      candidateBlinded: true,
      baselineBlinded: true,
      judgeBlinded: true,
      presentationRandomized: true,
    },
    seeds: [1],
    repetitions: 1,
    modelProviderRevisions: [],
    promptDigests: [],
    rubricRefs: [],
    toolManifestRefs: [],
    concurrency: 1,
    retryPolicy: { maxRetries: 1, retryableFailures: [], backoffMs: 100 },
    timeoutPolicy: { perCaseMs: 1000, perRunMs: 2000, totalMs: 3000 },
    environmentManifest: "env",
    hardwareManifest: "hw",
    budgetPolicyRef: budgetPolicyId("bp-1"),
    judgeProtocolRefs: [],
    redactionPolicyRef: "redact",
    exclusionPolicy: "none",
    planDigest: d("plan-d"),
    frozenAt: undefined,
    ...overrides,
  };
}

describe("Evaluation run plan helpers", () => {
  it("detects frozen plan", () => {
    expect(isPlanFrozen(makePlan({ frozenAt: "2026-01-05" }))).toBe(true);
  });

  it("rejects unfrozen plan", () => {
    expect(isPlanFrozen(makePlan({ frozenAt: undefined }))).toBe(false);
  });
});
